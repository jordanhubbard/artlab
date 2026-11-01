import type { RollupBuild, rollup as Rollup, SourceMapInput } from 'rollup'
import type { Node } from 'estree'

export interface SourceProvider { has(path: string): boolean; read(path: string): Promise<string> }
export interface ModulePackage {
  manifest: { entry: string }
  artFiles: Map<string, string>
  assetFiles?: Map<string, Uint8Array<ArrayBuffer>>
}
export interface CompilerOptions {
  library?: SourceProvider
  baseURL?: string
  rollup?: typeof Rollup
  transpile?(source: string, id: string): string | { code: string; map?: SourceMapInput } | Promise<string | { code: string; map?: SourceMapInput }>
}
const ROOT = 'https://workspace.artlab.invalid/'
const EXTERNALS = new Set(['three', 'tone', 'manifold-3d', '@dimforge/rapier3d-compat'])

/** Resolve a workspace path with URL semantics, independent of the hosting subpath. */
export function resolvePath(path: string, importer = '') {
  return decodeURIComponent(new URL(path, new URL(importer, ROOT)).pathname.slice(1))
}

/** Bundle editable JS/TS modules, including cycles, re-exports, and literal dynamic imports. */
export class ModuleCompiler {
  readonly library?: SourceProvider
  readonly baseURL: string
  private readonly _rollup?: typeof Rollup
  private readonly _transpile?: CompilerOptions['transpile']
  constructor({ library, baseURL, rollup, transpile }: CompilerOptions = {}) {
    this.library = library
    this.baseURL = baseURL ?? new URL(import.meta.env.BASE_URL, location.href).href
    this._rollup = rollup
    this._transpile = transpile
  }

  async compile({ manifest, artFiles, assetFiles = new Map() }: ModulePackage) {
    const files = new Map(artFiles)
    const dependencies = new Map<string, string>()
    const entry = resolvePath(manifest.entry)
    const rollup = this._rollup ?? (await import('@rollup/browser')).rollup
    const compiler = this
    const assetURLs = Object.fromEntries([...assetFiles].map(([path, bytes]) => [
      new URL(path, this.baseURL).href, URL.createObjectURL(new Blob([bytes])),
    ]))
    const dispose = () => Object.values(assetURLs).forEach(url => URL.revokeObjectURL(url))
    let bundle: RollupBuild | undefined
    try {
      bundle = await rollup({
        input: entry,
        onwarn(warning) {
          if (warning.code !== 'CIRCULAR_DEPENDENCY') console.warn(`[compiler] ${warning.message}`)
        },
        plugins: [{
          name: 'artlab-workspace',
          resolveId(source, importer) {
            if (source === 'artlab:assets') return '\0artlab:assets'
            if (EXTERNALS.has(source) || source.startsWith('three/addons/') || /^(https?:|data:|blob:)/.test(source)) {
              return { id: source, external: true }
            }
            const path = importer ? resolvePath(source, importer) : resolvePath(source)
            const candidates = [path, `${path}.ts`, `${path}.js`, `${path}/index.ts`, `${path}/index.js`]
            const found = candidates.find(candidate => files.has(candidate) || compiler.library?.has(candidate))
            if (!found) throw new Error(`Cannot resolve '${source}'${importer ? ` from ${importer}` : ''}`)
            return found
          },
          async load(id) {
            if (id === '\0artlab:assets') return `
              const assets = ${JSON.stringify(assetURLs)};
              export function assetURL(input, base) {
                const url = new URL(input, base);
                return new URL(assets[url.href] ?? url.href);
              }
            `
            const source = files.get(id) ?? await compiler.library?.read(id)
            if (source === undefined) throw new Error(`Source not found: ${id}`)
            dependencies.set(id, source)
            if (id.endsWith('.json')) return `export default ${source}`
            return source
          },
          async transform(source, id) {
            let code = source
            let map: SourceMapInput = null
            if (id.endsWith('.ts')) {
              if (compiler._transpile) {
                const result = await compiler._transpile(source, id)
                code = typeof result === 'string' ? result : result.code
                map = typeof result === 'string' ? null : result.map ?? null
              } else {
                const ts = await import('typescript')
                const result = ts.transpileModule(source, {
                  fileName: id, reportDiagnostics: true,
                  compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, sourceMap: true },
                })
                const error = result.diagnostics?.find(d => d.category === ts.DiagnosticCategory.Error)
                if (error) throw new Error(`${id}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`)
                code = result.outputText
                map = result.sourceMapText ?? null
              }
            }
            if (assetFiles.size && !id.startsWith('\0')) {
              const replacements: { start: number; end: number }[] = []
              visit(this.parse(code), node => {
                if (node.type !== 'NewExpression') return
                const base = node.arguments[1]
                if (node.callee.type === 'Identifier' && node.callee.name === 'URL' &&
                    base?.type === 'MemberExpression' && base.property.type === 'Identifier' && base.property.name === 'url' &&
                    base.object.type === 'MetaProperty' && base.object.meta.name === 'import') {
                  const callee = node.callee as typeof node.callee & { start: number; end: number }
                  replacements.push({ start: callee.start, end: callee.end })
                }
              })
              for (const { start, end } of replacements.sort((a, b) => b.start - a.start)) {
                code = code.slice(0, start) + '__artlabAssetURL' + code.slice(end)
              }
              if (replacements.length) {
                code = "import { assetURL as __artlabAssetURL } from 'artlab:assets';\n" + code
                map = null
              }
            }
            return code === source ? null : { code, map }
          },
          resolveImportMeta(property, { moduleId }) {
            if (property === 'url') return JSON.stringify(new URL(moduleId, compiler.baseURL).href)
            return null
          },
        }],
      })
      const { output } = await bundle.generate({ format: 'es', inlineDynamicImports: true, sourcemap: 'inline' })
      const chunk = output.find(file => file.type === 'chunk' && file.isEntry)
      if (!chunk || chunk.type !== 'chunk') throw new Error('Compiler produced no entry chunk')
      return { code: chunk.code, dependencies, dispose }
    } catch (error) {
      dispose()
      throw error
    } finally {
      await bundle?.close()
    }
  }
}

function visit(node: unknown, callback: (node: Node) => void): void {
  if (!node || typeof node !== 'object') return
  if ('type' in node && typeof node.type === 'string') callback(node as Node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => visit(child, callback))
    else if (value && typeof value === 'object') visit(value, callback)
  }
}

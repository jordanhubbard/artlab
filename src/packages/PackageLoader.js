/**
 * PackageLoader — load and execute an Artlab package.
 *
 * Given a zip blob or a URL pointing to one, this class:
 *  1. Fetches the zip (if a URL string is provided).
 *  2. Opens the zip with PackageReader and reads the manifest.
 *  3. Reads the entry .art file.
 *  4. Resolves dependencies:
 *       - In dev mode: via DevResolver (live URL fetching).
 *       - Otherwise: from the embedded libs/ directory in the zip.
 *  5. Transpiles the entry DSL to JavaScript via src/dsl/Transpiler.js.
 *  6. Creates a Blob URL from the generated JS and dynamic-imports it.
 *  7. Returns { manifest, module, reader }.
 *
 * NOTE: src/dsl/Transpiler.js does not exist yet.  Until it is created,
 * PackageLoader wraps the DSL source in a stub module that exposes the raw
 * source text so callers can at least inspect the package contents.
 */

import { PackageReader }  from './PackageReader.js'
import { DevResolver }    from './DevResolver.js'
import { MANIFEST_FILENAME } from './Manifest.js'

/** @type {Function|null} */
let _transpiler = null

/**
 * Lazily import the Transpiler. Returns null if it is not yet available.
 * @returns {Promise<Function|null>}
 */
async function loadTranspiler() {
  if (_transpiler !== null) return _transpiler
  try {
    const mod   = await import('../dsl/Transpiler.js')
    _transpiler = mod.transpile ?? mod.default ?? null
    return _transpiler
  } catch {
    // Transpiler not yet implemented — use stub
    return null
  }
}

/**
 * Fetch an ArrayBuffer from a URL.
 * @param {string} url
 * @returns {Promise<ArrayBuffer>}
 */
async function fetchZip(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`PackageLoader: failed to fetch package "${url}": HTTP ${response.status} ${response.statusText}`)
  }
  return response.arrayBuffer()
}

/**
 * Convert DSL source + resolved dependency sources to a JS module string.
 *
 * If the real Transpiler is available it is called; otherwise a lightweight
 * stub module is returned that simply exports the raw source text.
 *
 * @param {string}                        entrySource  - DSL text of the entry file
 * @param {Map<string, string>}           depSources   - libName → DSL text
 * @param {Function|null}                 transpile    - transpile(source, deps) → string
 * @param {import('./Manifest.js').ArtlabManifest} manifest
 * @returns {string} JavaScript module source
 */
function toJsModule(entrySource, depSources, transpile, manifest) {
  if (transpile) {
    try {
      return transpile(entrySource, Object.fromEntries(depSources), manifest)
    } catch (err) {
      throw new Error(`PackageLoader: transpilation failed: ${err.message}`)
    }
  }

  // Stub — Transpiler not yet available
  const escapedSource = JSON.stringify(entrySource)
  const depsObj = JSON.stringify(Object.fromEntries(depSources))
  return [
    `// Artlab package stub — real Transpiler not yet available`,
    `export const __artlabSource = ${escapedSource};`,
    `export const __artlabDeps   = ${depsObj};`,
    `export const __artlabStub   = true;`,
    `export default { __artlabSource: ${escapedSource}, __artlabStub: true };`,
  ].join('\n')
}

export class PackageLoader {
  /**
   * Load an Artlab package and return its scene module.
   *
   * @param {ArrayBuffer|Blob|string} source - zip data or URL to a zip
   * @param {Object}  [options]
   * @param {boolean} [options.devMode=false] - use DevResolver for URL deps
   * @returns {Promise<{
   *   manifest: import('./Manifest.js').ArtlabManifest,
   *   module: object,
   *   reader: PackageReader
   * }>}
   */
  async load(source, options = {}) {
    const { devMode = false } = options

    // ── 1. Obtain zip data ────────────────────────────────────────────────────

    let zipData
    if (typeof source === 'string') {
      zipData = await fetchZip(source)
    } else if (source instanceof Blob) {
      zipData = source
    } else if (source instanceof ArrayBuffer) {
      zipData = source
    } else {
      throw new TypeError('PackageLoader.load: source must be a string URL, ArrayBuffer, or Blob')
    }

    // ── 2. Open zip, read manifest ────────────────────────────────────────────

    const reader = new PackageReader(zipData)
    await reader.init()

    const manifest = await reader.getManifest()

    // ── 3. Read entry .art file ───────────────────────────────────────────────

    let entrySource
    try {
      entrySource = await reader.readFile(manifest.entry)
    } catch (err) {
      throw new Error(
        `PackageLoader: entry file "${manifest.entry}" listed in manifest not found in zip: ${err.message}`
      )
    }

    // ── 4. Resolve dependencies ───────────────────────────────────────────────

    /** @type {Map<string, string>} libName → DSL source */
    const depSources = new Map()

    if (devMode && manifest.dependencies) {
      const resolver = new DevResolver()
      await resolver.prefetch(entrySource)

      for (const [libName, libUrl] of Object.entries(manifest.dependencies)) {
        let src = resolver.resolve(libUrl)
        if (src === null) {
          // Not cached by prefetch — fetch explicitly
          src = await resolver.fetch(libUrl)
        }
        depSources.set(libName, src)
      }
    } else {
      // Non-dev mode: try to load deps from embedded libs/ directory
      const allFiles = reader.listFiles()
      const libFiles = allFiles.filter(p => p.startsWith('libs/') && p.endsWith('.art'))

      for (const libPath of libFiles) {
        const libName = libPath
          .replace(/^libs\//, '')
          .replace(/\.art$/, '')
        try {
          depSources.set(libName, await reader.readFile(libPath))
        } catch {
          // Skip unreadable lib files gracefully
        }
      }
    }

    // ── 5. Transpile DSL → JS ─────────────────────────────────────────────────

    const transpile = await loadTranspiler()
    const jsCode    = toJsModule(entrySource, depSources, transpile, manifest)

    // ── 6. Dynamic-import via Blob URL ────────────────────────────────────────

    const blobUrl = URL.createObjectURL(
      new Blob([jsCode], { type: 'text/javascript' })
    )

    let mod
    try {
      mod = await import(/* @vite-ignore */ blobUrl)
    } catch (err) {
      throw new Error(`PackageLoader: failed to import generated module: ${err.message}`)
    } finally {
      URL.revokeObjectURL(blobUrl)
    }

    // ── 7. Return result ──────────────────────────────────────────────────────

    return { manifest, module: mod, reader }
  }
}

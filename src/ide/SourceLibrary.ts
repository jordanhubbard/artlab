// Raw source stays available in production, independently of Vite's executable bundles.
const sources = import.meta.glob<string>([
  '/src/**/*.{js,ts}', '/examples/**/*.{js,ts,json}',
  '!**/*.test.*', '!**/*.spec.*', '!**/__tests__/**',
], { query: '?raw', import: 'default' })

/** Lazy, searchable source catalog; workspace edits always take precedence. */
export class SourceLibrary {
  readonly loaders: Map<string, () => Promise<string>>
  constructor(loaders: Record<string, () => Promise<string>> = sources) {
    this.loaders = new Map(Object.entries(loaders).map(([path, read]) => [path.replace(/^\//, ''), read]))
  }

  list(prefix = '') { return [...this.loaders.keys()].filter(path => path.startsWith(prefix)).sort() }
  has(path: string) { return this.loaders.has(path) }

  async read(path: string) {
    const read = this.loaders.get(path)
    if (!read) throw new Error(`Source not found: ${path}`)
    return read()
  }

  async assetsFor(entry: string, existing: Map<string, Uint8Array<ArrayBuffer>> = new Map()): Promise<Map<string, Uint8Array<ArrayBuffer>>> {
    if (!this.has(entry)) return new Map()
    const example = entry.match(/^examples\/[^/]+\//)?.[0]
    if (!example) return new Map()
    const base = new URL(import.meta.env.BASE_URL, location.href)
    const response = await fetch(new URL('examples-assets.json', base))
    if (!response.ok) throw new Error('Could not load the example asset catalog')
    const catalog: unknown = await response.json()
    if (!Array.isArray(catalog) || !catalog.every((path): path is string => typeof path === 'string')) throw new Error('Invalid example asset catalog')
    const paths = catalog.filter(path => path.startsWith(example) && !existing.has(path))
    return new Map(await Promise.all(paths.map(async path => {
      const asset = await fetch(new URL(path, base))
      if (!asset.ok) throw new Error(`Could not load asset: ${path}`)
      return [path, new Uint8Array(await asset.arrayBuffer())] as const
    })))
  }

  async example(name: string) {
    const prefix = `examples/${name}/`
    const files = new Map(await Promise.all(this.list(prefix).map(async path => [path, await this.read(path)] as const)))
    const source = files.get(`${prefix}artlab.json`)
    if (source === undefined) throw new Error(`Manifest not found: ${prefix}artlab.json`)
    const parsed: unknown = JSON.parse(source)
    if (!parsed || typeof parsed !== 'object' || !('entry' in parsed) || typeof parsed.entry !== 'string') throw new Error('Manifest requires a string entry')
    const manifest = { ...parsed, entry: parsed.entry }
    manifest.entry = prefix + manifest.entry
    files.set('artlab.json', JSON.stringify(manifest, null, 2))
    files.delete(`${prefix}artlab.json`)
    return { manifest, artFiles: files }
  }
}

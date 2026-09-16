// Raw source stays available in production, independently of Vite's executable bundles.
const sources = import.meta.glob([
  '/src/**/*.{js,ts}', '/examples/**/*.{js,ts,json}',
  '!**/*.test.*', '!**/*.spec.*', '!**/__tests__/**',
], { query: '?raw', import: 'default' })

/** Lazy, searchable source catalog; workspace edits always take precedence. */
export class SourceLibrary {
  constructor(loaders = sources) {
    this.loaders = new Map(Object.entries(loaders).map(([path, read]) => [path.replace(/^\//, ''), read]))
  }

  list(prefix = '') { return [...this.loaders.keys()].filter(path => path.startsWith(prefix)).sort() }
  has(path) { return this.loaders.has(path) }

  async read(path) {
    const read = this.loaders.get(path)
    if (!read) throw new Error(`Source not found: ${path}`)
    return read()
  }

  async assetsFor(entry, existing = new Map()) {
    if (!this.has(entry)) return new Map()
    const example = entry.match(/^examples\/[^/]+\//)?.[0]
    if (!example) return new Map()
    const base = new URL(import.meta.env.BASE_URL, location.href)
    const response = await fetch(new URL('examples-assets.json', base))
    if (!response.ok) throw new Error('Could not load the example asset catalog')
    const paths = (await response.json()).filter(path => path.startsWith(example) && !existing.has(path))
    return new Map(await Promise.all(paths.map(async path => {
      const asset = await fetch(new URL(path, base))
      if (!asset.ok) throw new Error(`Could not load asset: ${path}`)
      return [path, new Uint8Array(await asset.arrayBuffer())]
    })))
  }

  async example(name) {
    const prefix = `examples/${name}/`
    const files = new Map(await Promise.all(this.list(prefix).map(async path => [path, await this.read(path)])))
    const manifest = JSON.parse(files.get(`${prefix}artlab.json`))
    manifest.entry = prefix + manifest.entry
    files.set('artlab.json', JSON.stringify(manifest, null, 2))
    files.delete(`${prefix}artlab.json`)
    return { manifest, artFiles: files }
  }
}

/**
 * StaticLinker — embed URL dependencies into a self-contained package.
 *
 * Given a PackageReader (source package) and a DevResolver, the linker:
 *  1. Reads all DSL files from the package.
 *  2. Discovers `use url:"…"` imports transitively.
 *  3. Fetches each dependency via the resolver.
 *  4. Embeds each fetched source under libs/<sanitized-name>.art inside
 *     the new package.
 *  5. Rewrites the import directives from `use url:"…"` to
 *     `use embedded:"<libname>"` so the runtime can load them locally.
 *  6. Returns a PackageWriter populated with all files.
 */

import { PackageWriter }   from './PackageWriter.js'
import { MANIFEST_FILENAME } from './Manifest.js'

/** Matches `use url:"<url>"` in DSL source. */
const USE_URL_RE = /\buse\s+url\s*:\s*"([^"]+)"/g

/** File extensions considered DSL source files. */
const DSL_EXTENSIONS = ['.art']

/**
 * Derive a stable embedded lib name from a URL.
 * e.g. "https://artlab.dev/stdlib/geometry@0.1.0.art" → "artlab/stdlib/geometry@0.1.0"
 *
 * @param {string} url
 * @returns {string}
 */
function urlToLibName(url) {
  try {
    const u = new URL(url)
    // Strip leading slash and .art extension
    let path = u.pathname.replace(/^\//, '').replace(/\.art$/, '')
    return u.hostname.replace(/^www\./, '') + '/' + path
  } catch {
    // Fallback: sanitise the raw URL string
    return url
      .replace(/^https?:\/\//, '')
      .replace(/\.art$/, '')
      .replace(/[^a-zA-Z0-9._/@-]/g, '_')
  }
}

/**
 * Derive a libs/ path from a lib name.
 * @param {string} libName
 * @returns {string}
 */
function libNameToPath(libName) {
  return `libs/${libName}.art`
}

export class StaticLinker {
  /**
   * @param {import('./PackageReader.js').PackageReader} reader
   * @param {import('./DevResolver.js').DevResolver}    resolver
   */
  constructor(reader, resolver) {
    this._reader   = reader
    this._resolver = resolver
  }

  /**
   * Walk all DSL files in the source package, collect URL dependencies
   * transitively, fetch and embed them, then return a fully populated
   * PackageWriter.
   *
   * @param {(progress: {fetched: number, total: number, current: string}) => void} [onProgress]
   * @returns {Promise<PackageWriter>}
   */
  async link(onProgress = () => {}) {
    const reader  = this._reader
    const writer  = new PackageWriter()

    // ── Step 1: collect all files from the source package ──────────────────
    const allPaths = reader.listFiles()

    // ── Step 2: read all DSL files and scan for URL imports ─────────────────

    /** @type {Map<string, string>}  path → source text */
    const dslSources = new Map()

    for (const path of allPaths) {
      if (path === MANIFEST_FILENAME) continue
      if (DSL_EXTENSIONS.some(ext => path.endsWith(ext))) {
        dslSources.set(path, await reader.readFile(path))
      }
    }

    // ── Step 3: discover all URL deps transitively ───────────────────────────

    /** @type {Set<string>} URLs to fetch */
    const urlQueue   = new Set()
    /** @type {Map<string, string>} url → DSL source (fetched dependencies) */
    const urlSources = new Map()

    // Seed with URLs found in the package's own DSL files
    for (const source of dslSources.values()) {
      this._collectUrls(source, urlQueue)
    }

    let fetched = 0
    const reportProgress = (current) => {
      onProgress({ fetched, total: urlQueue.size, current })
    }

    // BFS: fetch each URL, then scan its source for more URLs
    const visited = new Set()
    while (true) {
      const pending = [...urlQueue].filter(u => !visited.has(u))
      if (pending.length === 0) break

      await Promise.all(pending.map(async (url) => {
        visited.add(url)
        reportProgress(url)
        try {
          const source = await this._resolver.fetch(url)
          urlSources.set(url, source)
          fetched++
          // Discover transitive deps
          this._collectUrls(source, urlQueue)
        } catch (err) {
          console.warn(`StaticLinker: skipping unresolvable URL "${url}": ${err.message}`)
          urlSources.set(url, `// StaticLinker: failed to fetch ${url}\n// ${err.message}\n`)
          fetched++
        }
        reportProgress(url)
      }))
    }

    // ── Step 4: build URL → embedded name mapping ────────────────────────────

    /** @type {Map<string, string>} url → embedded lib name */
    const urlToEmbeddedName = new Map()
    for (const url of urlSources.keys()) {
      urlToEmbeddedName.set(url, urlToLibName(url))
    }

    // ── Step 5: write rewritten DSL files ────────────────────────────────────

    for (const [path, source] of dslSources) {
      const rewritten = this.rewriteImports(source, urlToEmbeddedName)
      writer.addTextFile(path, rewritten)
    }

    // ── Step 6: embed fetched dependencies under libs/ ───────────────────────

    for (const [url, source] of urlSources) {
      const libName    = urlToEmbeddedName.get(url)
      const libPath    = libNameToPath(libName)
      // Also rewrite any transitive imports within the fetched source
      const rewritten  = this.rewriteImports(source, urlToEmbeddedName)
      writer.addTextFile(libPath, rewritten)
    }

    // ── Step 7: copy non-DSL files (assets, etc.) ────────────────────────────

    for (const path of allPaths) {
      if (path === MANIFEST_FILENAME) continue
      if (DSL_EXTENSIONS.some(ext => path.endsWith(ext))) continue
      const blob = await reader.readAsset(path)
      writer.addBinaryFile(path, blob)
    }

    // ── Step 8: write updated manifest ───────────────────────────────────────

    const manifest = await reader.getManifest()
    // Remove URL dependencies — they are now embedded
    const linkedManifest = {
      ...manifest,
      dependencies: undefined,
    }
    // Remove undefined key cleanly
    if (linkedManifest.dependencies === undefined) {
      delete linkedManifest.dependencies
    }
    writer.setManifest(linkedManifest)

    return writer
  }

  /**
   * Rewrite `use url:"<url>"` directives to `use embedded:"<libname>"` in
   * DSL source text.
   *
   * @param {string} source
   * @param {Map<string, string>} urlToEmbeddedName  - url → embedded lib name
   * @returns {string}
   */
  rewriteImports(source, urlToEmbeddedName) {
    USE_URL_RE.lastIndex = 0
    return source.replace(USE_URL_RE, (match, url) => {
      const name = urlToEmbeddedName.get(url)
      if (!name) return match   // unknown URL — leave as-is
      return `use embedded:"${name}"`
    })
  }

  // ── private helpers ───────────────────────────────────────────────────────

  /**
   * Scan DSL source for all `use url:"…"` patterns and add new URLs to the
   * provided set.
   *
   * @param {string}      source
   * @param {Set<string>} into
   */
  _collectUrls(source, into) {
    USE_URL_RE.lastIndex = 0
    let match
    while ((match = USE_URL_RE.exec(source)) !== null) {
      into.add(match[1])
    }
  }
}

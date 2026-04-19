/**
 * DevResolver — resolve DSL `use url:"…"` imports in development mode.
 *
 * Strategy:
 *  1. Try a direct fetch with cache headers.
 *  2. If the fetch fails (e.g. CORS), retry via the local proxy path
 *     /artlab-proxy?url=<encoded-url>.
 *  3. stdlib names (e.g. "artlab/geometry") return a placeholder comment
 *     so the DSL transpiler can continue without a network round-trip.
 */

/** Pattern that matches `use url:"<url>"` in DSL source. */
const USE_URL_RE = /\buse\s+url\s*:\s*"([^"]+)"/g

/** Stdlib name pattern: starts with "artlab/" and has no scheme. */
const STDLIB_RE = /^artlab\/[\w/]+$/

/** Proxy path used to sidestep CORS in dev. */
const PROXY_PREFIX = '/artlab-proxy?url='

export class DevResolver {
  constructor() {
    /** @type {Map<string, string>} url/name → DSL source */
    this._cache = new Map()
  }

  /**
   * Scan DSL source for all `use url:"…"` declarations and pre-fetch each
   * URL so that subsequent resolve() calls are synchronous.
   *
   * @param {string} source - DSL source text
   * @returns {Promise<void>}
   */
  async prefetch(source) {
    const urls = []
    let match
    USE_URL_RE.lastIndex = 0
    while ((match = USE_URL_RE.exec(source)) !== null) {
      const url = match[1]
      if (!this._cache.has(url)) {
        urls.push(url)
      }
    }

    await Promise.all(urls.map(url => this._fetchAndCache(url)))
  }

  /**
   * Resolve a library name or URL to DSL source text.
   *
   * - Stdlib names (e.g. "artlab/geometry") → placeholder comment.
   * - URLs already prefetched → cached source.
   * - Uncached URLs → null (call prefetch() first, or use DevResolver.fetch()).
   *
   * @param {string} nameOrUrl
   * @returns {string|null}
   */
  resolve(nameOrUrl) {
    if (STDLIB_RE.test(nameOrUrl)) {
      return `// stdlib ${nameOrUrl} — resolved at runtime\n`
    }
    return this._cache.get(nameOrUrl) ?? null
  }

  /**
   * Fetch a URL directly, bypassing the pre-fetch queue.
   * Useful when you need to resolve a single dependency synchronously
   * after awaiting this method.
   *
   * @param {string} url
   * @returns {Promise<string>}
   */
  async fetch(url) {
    if (!this._cache.has(url)) {
      await this._fetchAndCache(url)
    }
    return this._cache.get(url)
  }

  // ── private ────────────────────────────────────────────────────────────────

  /**
   * Attempt to fetch a URL. Falls back to the local proxy on failure.
   * @param {string} url
   * @returns {Promise<void>}
   */
  async _fetchAndCache(url) {
    let source = null

    // 1. Direct fetch
    try {
      source = await this._fetchDirect(url)
    } catch (directErr) {
      // 2. Proxy fallback
      try {
        source = await this._fetchViaProxy(url)
      } catch (proxyErr) {
        throw new Error(
          `DevResolver: failed to fetch "${url}"\n` +
          `  Direct: ${directErr.message}\n` +
          `  Proxy:  ${proxyErr.message}`
        )
      }
    }

    this._cache.set(url, source)
  }

  /**
   * @param {string} url
   * @returns {Promise<string>}
   */
  async _fetchDirect(url) {
    const response = await fetch(url, {
      cache: 'no-cache',
      headers: { Accept: 'text/plain, */*' },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }
    return response.text()
  }

  /**
   * @param {string} url
   * @returns {Promise<string>}
   */
  async _fetchViaProxy(url) {
    const proxyUrl = `${PROXY_PREFIX}${encodeURIComponent(url)}`
    const response = await fetch(proxyUrl, { cache: 'no-cache' })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} (via proxy)`)
    }
    return response.text()
  }
}

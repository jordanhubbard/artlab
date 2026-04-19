/**
 * DevResolver — resolve DSL `use url:"…"` imports at runtime.
 *
 * Strategy:
 *  1. Normalize bare npm specifiers (e.g. "lodash@4/fp") to jsDelivr URLs.
 *  2. Fetch the URL directly.  All supported CDNs send CORS-open headers
 *     so no local proxy is needed and the app can be hosted on GitHub Pages.
 *
 * Supported CDNs (all send Access-Control-Allow-Origin: *):
 *   https://cdn.jsdelivr.net/npm/<pkg>@<ver>/<path>
 *   https://unpkg.com/<pkg>@<ver>/<path>
 *   https://esm.sh/<pkg>@<ver>
 *   https://cdn.skypack.dev/<pkg>@<ver>
 *
 * Bare npm specifier shorthand — `use url:"npm:lodash@4/fp"` becomes
 * https://cdn.jsdelivr.net/npm/lodash@4/fp automatically.
 */

/** Pattern that matches `use url:"<url>"` in DSL source. */
const USE_URL_RE = /\buse\s+url\s*:\s*"([^"]+)"/g

/** Stdlib name pattern: starts with "artlab/" and has no scheme. */
const STDLIB_RE = /^artlab\/[\w/]+$/

/** npm bare specifier: starts with "npm:" */
const NPM_RE = /^npm:(.+)$/

/**
 * Normalize a name or URL to a fetchable HTTPS URL.
 * Returns null for stdlib names (handled separately).
 */
function normalize(nameOrUrl) {
  if (STDLIB_RE.test(nameOrUrl)) return null

  const npm = NPM_RE.exec(nameOrUrl)
  if (npm) return `https://cdn.jsdelivr.net/npm/${npm[1]}`

  // Already a full URL — trust it, but warn if it's not a known CDN
  if (nameOrUrl.startsWith('http://') || nameOrUrl.startsWith('https://')) {
    const known = [
      'cdn.jsdelivr.net', 'unpkg.com', 'esm.sh', 'cdn.skypack.dev',
    ]
    const host = new URL(nameOrUrl).hostname
    if (!known.some(h => host === h || host.endsWith('.' + h))) {
      console.warn(
        `[DevResolver] "${host}" may not send CORS headers.\n` +
        `Use a CORS-open CDN: cdn.jsdelivr.net, unpkg.com, esm.sh, or cdn.skypack.dev.\n` +
        `Or use the "npm:" shorthand: npm:<package>@<version>/<path>`
      )
    }
    return nameOrUrl
  }

  // Unknown form — pass through and let the fetch fail with a clear error
  return nameOrUrl
}

export class DevResolver {
  constructor() {
    /** @type {Map<string, string>} url/name → DSL source */
    this._cache = new Map()
  }

  /**
   * Scan DSL source for all `use url:"…"` declarations and pre-fetch each
   * URL so that subsequent resolve() calls are synchronous.
   * @param {string} source
   */
  async prefetch(source) {
    const urls = []
    let match
    USE_URL_RE.lastIndex = 0
    while ((match = USE_URL_RE.exec(source)) !== null) {
      const raw = match[1]
      if (!this._cache.has(raw)) urls.push(raw)
    }
    await Promise.all(urls.map(u => this._fetchAndCache(u)))
  }

  /**
   * Resolve a name or URL to its cached DSL source text.
   * @param {string} nameOrUrl
   * @returns {string|null}
   */
  resolve(nameOrUrl) {
    if (STDLIB_RE.test(nameOrUrl)) return `// stdlib ${nameOrUrl} — resolved at runtime\n`
    return this._cache.get(nameOrUrl) ?? null
  }

  /**
   * Fetch a URL (bypassing the pre-fetch queue).
   * @param {string} nameOrUrl
   * @returns {Promise<string>}
   */
  async fetch(nameOrUrl) {
    if (!this._cache.has(nameOrUrl)) await this._fetchAndCache(nameOrUrl)
    return this._cache.get(nameOrUrl)
  }

  // ── private ────────────────────────────────────────────────────────────────

  async _fetchAndCache(raw) {
    const url = normalize(raw)
    if (url === null) {
      // stdlib — no fetch needed
      this._cache.set(raw, `// stdlib ${raw} — resolved at runtime\n`)
      return
    }

    let text
    try {
      const res = await fetch(url, {
        cache: 'no-cache',
        headers: { Accept: 'text/plain, */*' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      text = await res.text()
    } catch (err) {
      throw new Error(
        `DevResolver: failed to fetch "${raw}" (resolved to "${url}")\n` +
        `  ${err.message}\n` +
        `  Tip: use cdn.jsdelivr.net, unpkg.com, esm.sh, or the npm: shorthand.`
      )
    }

    this._cache.set(raw, text)
  }
}

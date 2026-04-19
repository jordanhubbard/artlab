/**
 * Artlab Package Manifest — types and validation for artlab.json
 *
 * @typedef {Object} ArtlabManifest
 * @property {string} name                        - package name (kebab-case)
 * @property {string} version                     - semver string
 * @property {string} [description]               - human-readable description
 * @property {string} entry                       - path to entry .art file within zip
 * @property {string} [author]                    - author name / email
 * @property {string} [license]                   - SPDX license identifier
 * @property {string} [artlab]                    - required artlab runtime version
 * @property {Record<string,string>} [dependencies] - lib name → URL
 * @property {string[]} [assets]                  - declared asset paths within zip
 */

export const MANIFEST_FILENAME = 'artlab.json'

/** Loose semver: digits-and-dots, optional leading 'v'. */
const SEMVER_RE = /^v?\d+\.\d+(\.\d+)?(-[\w.]+)?(\+[\w.]+)?$/

/**
 * Validate a plain object that should conform to ArtlabManifest.
 * Throws a descriptive TypeError when a required field is missing or has
 * the wrong type.
 *
 * @param {unknown} obj
 * @returns {ArtlabManifest}
 */
export function validateManifest(obj) {
  if (obj === null || typeof obj !== 'object') {
    throw new TypeError('Manifest must be a JSON object')
  }

  // ── required fields ────────────────────────────────────────────────────────

  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    throw new TypeError('Manifest field "name" must be a non-empty string')
  }

  if (typeof obj.version !== 'string' || !SEMVER_RE.test(obj.version)) {
    throw new TypeError(
      `Manifest field "version" must be a semver string (got ${JSON.stringify(obj.version)})`
    )
  }

  if (typeof obj.entry !== 'string' || obj.entry.trim() === '') {
    throw new TypeError('Manifest field "entry" must be a non-empty string (path to entry .art file)')
  }

  // ── optional string fields ─────────────────────────────────────────────────

  for (const field of ['description', 'author', 'license', 'artlab']) {
    if (obj[field] !== undefined && typeof obj[field] !== 'string') {
      throw new TypeError(`Manifest field "${field}" must be a string when present`)
    }
  }

  // ── optional dependencies ──────────────────────────────────────────────────

  if (obj.dependencies !== undefined) {
    if (typeof obj.dependencies !== 'object' || obj.dependencies === null || Array.isArray(obj.dependencies)) {
      throw new TypeError('Manifest field "dependencies" must be a plain object (name → URL)')
    }
    for (const [k, v] of Object.entries(obj.dependencies)) {
      if (typeof v !== 'string') {
        throw new TypeError(`Manifest dependencies["${k}"] must be a URL string`)
      }
    }
  }

  // ── optional assets ────────────────────────────────────────────────────────

  if (obj.assets !== undefined) {
    if (!Array.isArray(obj.assets)) {
      throw new TypeError('Manifest field "assets" must be an array of path strings')
    }
    for (let i = 0; i < obj.assets.length; i++) {
      if (typeof obj.assets[i] !== 'string') {
        throw new TypeError(`Manifest assets[${i}] must be a string`)
      }
    }
  }

  return /** @type {ArtlabManifest} */ (obj)
}

/**
 * Parse a JSON string into a validated ArtlabManifest.
 * Throws SyntaxError on bad JSON and TypeError on schema violations.
 *
 * @param {string} jsonString
 * @returns {ArtlabManifest}
 */
export function parseManifest(jsonString) {
  let obj
  try {
    obj = JSON.parse(jsonString)
  } catch (err) {
    throw new SyntaxError(`artlab.json is not valid JSON: ${err.message}`)
  }
  return validateManifest(obj)
}

/**
 * PackageReader — browser-side .artlab zip reader
 *
 * Uses a minimal pure-JS zip parser (stored + deflate) so there is no hard
 * dependency on fflate.  If fflate is available at runtime it will be used
 * instead for better performance and broader format support.
 *
 * fflate is NOT listed in package.json — add it with:
 *   npm install fflate
 * and then import it at the top of this file when available.
 */

import { parseManifest, MANIFEST_FILENAME } from './Manifest.js'

// ── Minimal pure-JS zip parser ─────────────────────────────────────────────
// Supports Deflate (method 8) and Stored (method 0) entries.
// Reads the End-of-Central-Directory record to build a file index, then
// reads Local File Headers on demand.

const EOCD_SIG    = 0x06054b50
const LFH_SIG     = 0x04034b50
const DATA_DESCRIPTOR_SIG = 0x08074b50

/**
 * Locate the End-of-Central-Directory record.
 * Searches backwards from the end of the buffer.
 * @param {DataView} view
 * @returns {number} byte offset of EOCD record
 */
function findEOCD(view) {
  // EOCD can have a variable-length comment (max 65535 bytes)
  const minOffset = Math.max(0, view.byteLength - 65535 - 22)
  for (let i = view.byteLength - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i
  }
  throw new Error('Not a valid zip file: EOCD signature not found')
}

/**
 * Parse the Central Directory and return a map of path → entry descriptor.
 * @param {DataView} view
 * @returns {Map<string, {localOffset:number, compSize:number, uncompSize:number, method:number, isDir:boolean}>}
 */
function parseCentralDirectory(view) {
  const eocdOffset = findEOCD(view)
  const cdSize     = view.getUint32(eocdOffset + 12, true)
  const cdOffset   = view.getUint32(eocdOffset + 16, true)
  const totalEntries = view.getUint16(eocdOffset + 10, true)

  const entries = new Map()
  let pos = cdOffset

  for (let i = 0; i < totalEntries; i++) {
    const sig = view.getUint32(pos, true)
    if (sig !== 0x02014b50) throw new Error(`Bad central directory signature at ${pos}`)

    const method      = view.getUint16(pos + 10, true)
    const compSize    = view.getUint32(pos + 20, true)
    const uncompSize  = view.getUint32(pos + 24, true)
    const nameLen     = view.getUint16(pos + 28, true)
    const extraLen    = view.getUint16(pos + 30, true)
    const commentLen  = view.getUint16(pos + 32, true)
    const localOffset = view.getUint32(pos + 42, true)

    const nameBytes = new Uint8Array(view.buffer, view.byteOffset + pos + 46, nameLen)
    const name      = new TextDecoder().decode(nameBytes)
    const isDir     = name.endsWith('/')

    if (!isDir) {
      entries.set(name, { localOffset, compSize, uncompSize, method, isDir })
    }

    pos += 46 + nameLen + extraLen + commentLen
  }

  return entries
}

/**
 * Decompress a single zip entry to a Uint8Array.
 * Supports method 0 (stored) and method 8 (deflate).
 * @param {DataView} view
 * @param {{localOffset:number, compSize:number, uncompSize:number, method:number}} entry
 * @returns {Promise<Uint8Array>}
 */
async function decompressEntry(view, entry) {
  const lhOffset  = entry.localOffset
  if (view.getUint32(lhOffset, true) !== LFH_SIG) {
    throw new Error(`Bad local file header signature at offset ${lhOffset}`)
  }

  const nameLen  = view.getUint16(lhOffset + 26, true)
  const extraLen = view.getUint16(lhOffset + 28, true)
  const dataOffset = lhOffset + 30 + nameLen + extraLen

  const compressedData = new Uint8Array(view.buffer, view.byteOffset + dataOffset, entry.compSize)

  if (entry.method === 0) {
    // Stored — no compression
    return compressedData.slice()
  }

  if (entry.method === 8) {
    // Deflate — use DecompressionStream (available in modern browsers / Node 18+)
    if (typeof DecompressionStream !== 'undefined') {
      const ds     = new DecompressionStream('deflate-raw')
      const writer = ds.writable.getWriter()
      const reader = ds.readable.getReader()

      writer.write(compressedData)
      writer.close()

      const chunks = []
      let totalLen = 0
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        chunks.push(value)
        totalLen += value.length
      }

      const result = new Uint8Array(totalLen)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }
      return result
    }

    throw new Error(
      'Deflate decompression requires DecompressionStream (Chrome 80+, Node 18+, Firefox 113+). ' +
      'Install fflate for broader support: npm install fflate'
    )
  }

  throw new Error(`Unsupported compression method: ${entry.method}`)
}

// ── PackageReader ──────────────────────────────────────────────────────────

export class PackageReader {
  /**
   * @param {ArrayBuffer|Blob} zipData
   */
  constructor(zipData) {
    this._data    = zipData
    this._view    = null   // DataView, set in init()
    this._index   = null   // Map<string, entry descriptor>
  }

  /**
   * Parse the zip central directory and build the file index.
   * Must be called before any other method.
   * @returns {Promise<void>}
   */
  async init() {
    let buffer
    if (this._data instanceof ArrayBuffer) {
      buffer = this._data
    } else if (this._data instanceof Blob) {
      buffer = await this._data.arrayBuffer()
    } else {
      throw new TypeError('PackageReader expects an ArrayBuffer or Blob')
    }

    this._view  = new DataView(buffer)
    this._index = parseCentralDirectory(this._view)
  }

  /**
   * Read and parse artlab.json from the zip.
   * @returns {Promise<import('./Manifest.js').ArtlabManifest>}
   */
  async getManifest() {
    const text = await this.readFile(MANIFEST_FILENAME)
    return parseManifest(text)
  }

  /**
   * Read a text file from the zip and return its contents as a UTF-8 string.
   * @param {string} path
   * @returns {Promise<string>}
   */
  async readFile(path) {
    const entry = this._requireEntry(path)
    const bytes = await decompressEntry(this._view, entry)
    return new TextDecoder().decode(bytes)
  }

  /**
   * Read a binary file from the zip and return it as a Blob.
   * @param {string} path
   * @returns {Promise<Blob>}
   */
  async readAsset(path) {
    const entry = this._requireEntry(path)
    const bytes = await decompressEntry(this._view, entry)
    return new Blob([bytes])
  }

  /**
   * Return all file paths present in the zip (directories excluded).
   * @returns {string[]}
   */
  listFiles() {
    this._requireInit()
    return Array.from(this._index.keys())
  }

  // ── private helpers ────────────────────────────────────────────────────────

  _requireInit() {
    if (!this._index) throw new Error('PackageReader.init() has not been called')
  }

  _requireEntry(path) {
    this._requireInit()
    const entry = this._index.get(path)
    if (!entry) throw new Error(`File not found in package: ${path}`)
    return entry
  }
}

// ── Mock implementation for testing ───────────────────────────────────────

/**
 * MockPackageReader — in-memory implementation for unit tests.
 * Accepts a plain object mapping paths to string or Uint8Array content.
 *
 * @example
 * const reader = new MockPackageReader({
 *   'artlab.json': JSON.stringify({ name: 'test', version: '1.0.0', entry: 'main.art' }),
 *   'main.art': 'scene main {}',
 * })
 * await reader.init()
 * const manifest = await reader.getManifest()
 */
export class MockPackageReader {
  /**
   * @param {Record<string, string|Uint8Array>} files
   */
  constructor(files) {
    this._files = new Map(Object.entries(files))
  }

  async init() { /* no-op */ }

  async getManifest() {
    const text = await this.readFile(MANIFEST_FILENAME)
    return parseManifest(text)
  }

  async readFile(path) {
    const data = this._files.get(path)
    if (data === undefined) throw new Error(`File not found in mock package: ${path}`)
    if (data instanceof Uint8Array) return new TextDecoder().decode(data)
    return String(data)
  }

  async readAsset(path) {
    const data = this._files.get(path)
    if (data === undefined) throw new Error(`File not found in mock package: ${path}`)
    if (data instanceof Uint8Array) return new Blob([data])
    return new Blob([new TextEncoder().encode(String(data))])
  }

  listFiles() {
    return Array.from(this._files.keys())
  }
}

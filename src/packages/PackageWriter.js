/**
 * PackageWriter — create .artlab zip packages in the browser.
 *
 * Uses a minimal pure-JS zip writer (stored + deflate via CompressionStream).
 * No external dependencies required.  If CompressionStream is unavailable
 * (older environments) files are written as "stored" (method 0).
 */

import { validateManifest, MANIFEST_FILENAME } from './Manifest.js'

// ── Zip building utilities ─────────────────────────────────────────────────

const ENC = new TextEncoder()

/** Encode a 16-bit LE integer into an existing Uint8Array at offset. */
function u16(buf, offset, val) {
  buf[offset]     = val & 0xff
  buf[offset + 1] = (val >>> 8) & 0xff
}

/** Encode a 32-bit LE integer into an existing Uint8Array at offset. */
function u32(buf, offset, val) {
  buf[offset]     = val & 0xff
  buf[offset + 1] = (val >>> 8) & 0xff
  buf[offset + 2] = (val >>> 16) & 0xff
  buf[offset + 3] = (val >>> 24) & 0xff
}

/**
 * Compute CRC-32 of a Uint8Array.
 * Uses the standard 0xEDB88320 polynomial.
 * @param {Uint8Array} data
 * @returns {number}
 */
function crc32(data) {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Attempt to compress data with CompressionStream('deflate-raw').
 * Returns null when CompressionStream is unavailable or compression
 * produces a larger result than the original (store uncompressed instead).
 *
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array|null>}
 */
async function deflate(data) {
  if (typeof CompressionStream === 'undefined') return null

  try {
    const cs     = new CompressionStream('deflate-raw')
    const writer = cs.writable.getWriter()
    const reader = cs.readable.getReader()

    writer.write(data)
    writer.close()

    const chunks = []
    let totalLen = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      chunks.push(value)
      totalLen += value.length
    }

    if (totalLen >= data.length) return null   // not worth compressing

    const result = new Uint8Array(totalLen)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result
  } catch {
    return null
  }
}

/**
 * Build a Local File Header + data block as a Uint8Array.
 *
 * @param {string}     name         - path within zip
 * @param {Uint8Array} uncompData   - original (uncompressed) bytes
 * @param {Uint8Array} compData     - compressed bytes (same as uncompData for stored)
 * @param {number}     method       - 0=stored, 8=deflate
 * @param {number}     crc          - CRC-32 of uncompressed data
 * @returns {Uint8Array}
 */
function buildLocalEntry(name, uncompData, compData, method, crc) {
  const nameBytes = ENC.encode(name)
  const header    = new Uint8Array(30 + nameBytes.length)

  u32(header,  0, 0x04034b50)          // local file header sig
  u16(header,  4, 20)                  // version needed: 2.0
  u16(header,  6, 0)                   // general purpose bit flag
  u16(header,  8, method)              // compression method
  u16(header, 10, 0)                   // last mod time (0 = unset)
  u16(header, 12, 0)                   // last mod date
  u32(header, 14, crc)                 // CRC-32
  u32(header, 18, compData.length)     // compressed size
  u32(header, 22, uncompData.length)   // uncompressed size
  u16(header, 26, nameBytes.length)    // filename length
  u16(header, 28, 0)                   // extra field length
  header.set(nameBytes, 30)

  const entry = new Uint8Array(header.length + compData.length)
  entry.set(header)
  entry.set(compData, header.length)
  return entry
}

/**
 * Build a Central Directory entry record.
 *
 * @param {string}     name
 * @param {Uint8Array} uncompData
 * @param {Uint8Array} compData
 * @param {number}     method
 * @param {number}     crc
 * @param {number}     localOffset  - byte offset of the Local File Header
 * @returns {Uint8Array}
 */
function buildCentralEntry(name, uncompData, compData, method, crc, localOffset) {
  const nameBytes = ENC.encode(name)
  const record    = new Uint8Array(46 + nameBytes.length)

  u32(record,  0, 0x02014b50)          // central directory sig
  u16(record,  4, 20)                  // version made by
  u16(record,  6, 20)                  // version needed
  u16(record,  8, 0)                   // general purpose bit flag
  u16(record, 10, method)              // compression method
  u16(record, 12, 0)                   // last mod time
  u16(record, 14, 0)                   // last mod date
  u32(record, 16, crc)                 // CRC-32
  u32(record, 20, compData.length)     // compressed size
  u32(record, 24, uncompData.length)   // uncompressed size
  u16(record, 28, nameBytes.length)    // filename length
  u16(record, 30, 0)                   // extra field length
  u16(record, 32, 0)                   // file comment length
  u16(record, 34, 0)                   // disk number start
  u16(record, 36, 0)                   // internal attributes
  u32(record, 38, 0)                   // external attributes
  u32(record, 42, localOffset)         // relative offset of local header
  record.set(nameBytes, 46)

  return record
}

/**
 * Build the End-of-Central-Directory record.
 * @param {number} entryCount  - total number of entries
 * @param {number} cdSize      - size of the Central Directory in bytes
 * @param {number} cdOffset    - byte offset of the Central Directory
 * @returns {Uint8Array}
 */
function buildEOCD(entryCount, cdSize, cdOffset) {
  const record = new Uint8Array(22)
  u32(record,  0, 0x06054b50)   // EOCD sig
  u16(record,  4, 0)            // disk number
  u16(record,  6, 0)            // disk with CD
  u16(record,  8, entryCount)   // entries on this disk
  u16(record, 10, entryCount)   // total entries
  u32(record, 12, cdSize)       // central directory size
  u32(record, 16, cdOffset)     // central directory offset
  u16(record, 20, 0)            // comment length
  return record
}

// ── PackageWriter ──────────────────────────────────────────────────────────

export class PackageWriter {
  constructor() {
    /** @type {Map<string, ArrayBuffer|Blob|string>} */
    this._files = new Map()
  }

  /**
   * Set / replace the manifest.  Validates before storing.
   * @param {import('./Manifest.js').ArtlabManifest} manifest
   */
  setManifest(manifest) {
    validateManifest(manifest)
    this._files.set(MANIFEST_FILENAME, JSON.stringify(manifest, null, 2))
  }

  /**
   * Add (or replace) a text file at the given path.
   * @param {string} path
   * @param {string} content  - UTF-8 text
   */
  addTextFile(path, content) {
    if (typeof path !== 'string' || path.trim() === '') throw new TypeError('path must be a non-empty string')
    if (typeof content !== 'string') throw new TypeError('content must be a string')
    this._files.set(path, content)
  }

  /**
   * Add (or replace) a binary file at the given path.
   * @param {string} path
   * @param {ArrayBuffer|Blob} data
   */
  addBinaryFile(path, data) {
    if (typeof path !== 'string' || path.trim() === '') throw new TypeError('path must be a non-empty string')
    if (!(data instanceof ArrayBuffer) && !(data instanceof Blob)) {
      throw new TypeError('data must be an ArrayBuffer or Blob')
    }
    this._files.set(path, data)
  }

  /**
   * Build the zip and return it as a Blob.
   * Attempts deflate compression for each file; falls back to stored.
   * @returns {Promise<Blob>}
   */
  async build() {
    if (!this._files.has(MANIFEST_FILENAME)) {
      throw new Error('Cannot build package: manifest not set (call setManifest first)')
    }

    const localBlocks   = []   // Uint8Array[]
    const centralBlocks = []   // Uint8Array[]
    let currentOffset   = 0

    for (const [path, rawContent] of this._files) {
      // Normalise to Uint8Array
      let uncompData
      if (typeof rawContent === 'string') {
        uncompData = ENC.encode(rawContent)
      } else if (rawContent instanceof Blob) {
        uncompData = new Uint8Array(await rawContent.arrayBuffer())
      } else {
        uncompData = new Uint8Array(rawContent)
      }

      const crc         = crc32(uncompData)
      const compressed  = await deflate(uncompData)
      const compData    = compressed ?? uncompData
      const method      = compressed ? 8 : 0

      const local   = buildLocalEntry(path, uncompData, compData, method, crc)
      const central = buildCentralEntry(path, uncompData, compData, method, crc, currentOffset)

      localBlocks.push(local)
      centralBlocks.push(central)
      currentOffset += local.length
    }

    const cdOffset = currentOffset
    const cdSize   = centralBlocks.reduce((sum, b) => sum + b.length, 0)
    const eocd     = buildEOCD(this._files.size, cdSize, cdOffset)

    const parts = [...localBlocks, ...centralBlocks, eocd]
    return new Blob(parts, { type: 'application/zip' })
  }

  /**
   * Build the zip and trigger a browser download.
   * @param {string} [filename]
   */
  async download(filename = 'package.artlab') {
    const blob = await this.build()
    const url  = URL.createObjectURL(blob)
    try {
      const a    = document.createElement('a')
      a.href     = url
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      // Revoke after a short delay to allow the browser to start the download
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }
  }
}

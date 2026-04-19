#!/usr/bin/env node
/**
 * artlab — Artlab platform CLI
 *
 * Subcommands:
 *   create <name>   Scaffold a new Artlab package
 *   serve  [dir]    Start a Vite dev server for the package
 *   build  [dir]    Transpile .art files (syntax/semantic check)
 *   pack   [dir]    Bundle a package directory into <name>-<version>.zip
 *   upgrade [zip]   Re-fetch pinned URL deps and rewrite the zip
 */

import { parseArgs }                   from 'node:util'
import fs                              from 'node:fs'
import path                            from 'node:path'
import { spawnSync, spawn }            from 'node:child_process'
import { createRequire }               from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import zlib                            from 'node:zlib'

// ── Paths ─────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')   // repo root

// ── Helpers ───────────────────────────────────────────────────────────────────

function die(msg, code = 1) {
  console.error(`artlab: ${msg}`)
  process.exit(code)
}

function usage() {
  console.log(`
Usage:
  artlab create <name>     Create a new Artlab package scaffold
  artlab serve  [dir]      Start a dev server (default: current dir)
  artlab build  [dir]      Transpile .art files — syntax/semantic check
  artlab pack   [dir]      Bundle dir into <name>-<version>.zip
  artlab upgrade [zip]     Re-fetch pinned URL deps and update the zip
`.trim())
}

// ── Zip utilities (pure Node, no external deps) ───────────────────────────────
// Implements the ZIP format used by PackageWriter, but synchronously via zlib.

function u16le(val) {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(val, 0)
  return b
}

function u32le(val) {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(val >>> 0, 0)
  return b
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Deflate a buffer synchronously.  Returns null if compression makes it larger.
 * @param {Buffer} data
 * @returns {Buffer|null}
 */
function deflateSync(data) {
  try {
    const compressed = zlib.deflateRawSync(data, { level: 6 })
    return compressed.length < data.length ? compressed : null
  } catch {
    return null
  }
}

/**
 * Build an in-memory ZIP from an array of { name, data } entries.
 * @param {Array<{ name: string, data: Buffer }>} entries
 * @returns {Buffer}
 */
function buildZip(entries) {
  const localBlocks   = []
  const centralBlocks = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBytes   = Buffer.from(name, 'utf8')
    const crc         = crc32(data)
    const compressed  = deflateSync(data)
    const compData    = compressed ?? data
    const method      = compressed ? 8 : 0

    // Local file header
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),   // sig
      u16le(20),                                 // version needed
      u16le(0),                                  // flags
      u16le(method),                             // compression
      u16le(0), u16le(0),                        // mod time / date
      u32le(crc),
      u32le(compData.length),
      u32le(data.length),
      u16le(nameBytes.length),
      u16le(0),                                  // extra length
      nameBytes,
      compData,
    ])

    // Central directory entry
    const central = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),   // sig
      u16le(20), u16le(20),                      // version made / needed
      u16le(0),                                  // flags
      u16le(method),
      u16le(0), u16le(0),                        // mod time / date
      u32le(crc),
      u32le(compData.length),
      u32le(data.length),
      u16le(nameBytes.length),
      u16le(0), u16le(0),                        // extra / comment len
      u16le(0),                                  // disk start
      u16le(0),                                  // internal attrs
      u32le(0),                                  // external attrs
      u32le(offset),                             // local header offset
      nameBytes,
    ])

    localBlocks.push(local)
    centralBlocks.push(central)
    offset += local.length
  }

  const cdOffset = offset
  const cdSize   = centralBlocks.reduce((s, b) => s + b.length, 0)

  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),      // sig
    u16le(0), u16le(0),                          // disk num / disk with CD
    u16le(entries.length),                        // entries this disk
    u16le(entries.length),                        // total entries
    u32le(cdSize),
    u32le(cdOffset),
    u16le(0),                                    // comment len
  ])

  return Buffer.concat([...localBlocks, ...centralBlocks, eocd])
}

/**
 * Parse a ZIP buffer into an array of { name, data } entries.
 * Simple linear scan — handles standard ZIP files produced by buildZip.
 * @param {Buffer} buf
 * @returns {Array<{ name: string, data: Buffer }>}
 */
function parseZip(buf) {
  const entries = []
  let pos = 0

  while (pos + 4 <= buf.length) {
    const sig = buf.readUInt32LE(pos)

    if (sig === 0x04034b50) {
      // Local file header
      const method        = buf.readUInt16LE(pos + 8)
      const crc           = buf.readUInt32LE(pos + 14)
      const compSize      = buf.readUInt32LE(pos + 18)
      const uncompSize    = buf.readUInt32LE(pos + 22)
      const nameLen       = buf.readUInt16LE(pos + 26)
      const extraLen      = buf.readUInt16LE(pos + 28)
      const name          = buf.toString('utf8', pos + 30, pos + 30 + nameLen)
      const dataStart     = pos + 30 + nameLen + extraLen
      const compData      = buf.slice(dataStart, dataStart + compSize)

      let data
      if (method === 8) {
        data = zlib.inflateRawSync(compData)
      } else {
        data = compData
      }

      entries.push({ name, data })
      pos = dataStart + compSize
    } else if (sig === 0x02014b50 || sig === 0x06054b50) {
      break  // central dir or EOCD — done with local entries
    } else {
      break  // unknown — stop
    }
  }

  return entries
}

// ── Subcommand: create ────────────────────────────────────────────────────────

function cmdCreate(name) {
  if (!name) die('create requires a package <name>')

  const kebab = name.replace(/\s+/g, '-').toLowerCase()
  const dir   = path.resolve(process.cwd(), kebab)

  if (fs.existsSync(dir)) die(`directory already exists: ${dir}`)

  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true })

  const manifest = {
    name:        kebab,
    version:     '0.1.0',
    description: '',
    entry:       'main.art',
    author:      '',
    license:     'MIT',
    artlab:      '>=0.1.0',
    dependencies: {},
    assets:      [],
  }

  fs.writeFileSync(
    path.join(dir, 'artlab.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  )

  fs.writeFileSync(
    path.join(dir, 'main.art'),
    `// ${kebab} — Artlab package entry point\n\nfn setup(ctx) {\n  // your code here\n}\n`,
  )

  console.log(`Created package scaffold at: ${dir}`)
  console.log('  artlab.json')
  console.log('  main.art')
  console.log('  assets/')
}

// ── Subcommand: serve ─────────────────────────────────────────────────────────

function cmdServe(dir) {
  const target = path.resolve(process.cwd(), dir ?? '.')

  if (!fs.existsSync(target)) die(`directory not found: ${target}`)

  // Find vite binary — prefer local to repo root, then PATH
  const viteBin = (() => {
    const local = path.join(ROOT, 'node_modules', '.bin', 'vite')
    if (fs.existsSync(local)) return local
    return 'vite'
  })()

  console.log(`Starting dev server for: ${target}`)
  console.log('Local URL: http://localhost:5173')

  const child = spawn(viteBin, ['--root', target], {
    stdio: 'inherit',
    cwd:   ROOT,
    env:   {
      ...process.env,
      // Map /artlab/stdlib/* → src/stdlib/*.js via Vite alias (configured
      // separately in vite.config.js; this env var signals intent for scripts).
      ARTLAB_STDLIB: path.join(ROOT, 'src', 'stdlib'),
    },
  })

  child.on('error', err => die(`Failed to start vite: ${err.message}`))
  child.on('exit',  code => process.exit(code ?? 0))
}

// ── Subcommand: build ─────────────────────────────────────────────────────────

async function cmdBuild(dir) {
  const target = path.resolve(process.cwd(), dir ?? '.')

  if (!fs.existsSync(target)) die(`directory not found: ${target}`)

  // Dynamically import the DSL Transpiler (ESM from src/)
  const transpilerPath = pathToFileURL(path.join(ROOT, 'src', 'dsl', 'Transpiler.js')).href
  let Transpiler
  try {
    ;({ Transpiler } = await import(transpilerPath))
  } catch (err) {
    die(`Could not load DSL Transpiler: ${err.message}`)
  }

  // Gather all .art files recursively
  const artFiles = []
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile() && entry.name.endsWith('.art')) {
        artFiles.push(full)
      }
    }
  }
  walk(target)

  if (artFiles.length === 0) {
    console.log('No .art files found.')
    return
  }

  const transpiler = new Transpiler()
  let anyError = false

  for (const file of artFiles) {
    const src    = fs.readFileSync(file, 'utf8')
    const rel    = path.relative(target, file)
    const result = transpiler.transpile(src)

    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        console.warn(`  warn  ${rel}:${w.line}:${w.col}  ${w.message}`)
      }
    }

    if (!result.ok) {
      anyError = true
      for (const e of result.errors) {
        console.error(`  error ${rel}:${e.line}:${e.col}  ${e.message}`)
      }
      console.error(`  FAIL  ${rel}`)
    } else {
      console.log(`  ok    ${rel}`)
    }
  }

  if (anyError) {
    console.error(`\nBuild failed.`)
    process.exit(1)
  } else {
    console.log(`\nBuild succeeded (${artFiles.length} file${artFiles.length !== 1 ? 's' : ''}).`)
  }
}

// ── Subcommand: pack ──────────────────────────────────────────────────────────

function cmdPack(dir) {
  const target = path.resolve(process.cwd(), dir ?? '.')

  if (!fs.existsSync(target)) die(`directory not found: ${target}`)

  const manifestPath = path.join(target, 'artlab.json')
  if (!fs.existsSync(manifestPath)) die(`artlab.json not found in: ${target}`)

  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    die(`Failed to read artlab.json: ${err.message}`)
  }

  if (!manifest.name || !manifest.version) die('artlab.json must have "name" and "version" fields')

  // Collect all files recursively (relative paths within the zip)
  const entries = []
  function walk(d, base) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full    = path.join(d, entry.name)
      const relPath = base ? `${base}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(full, relPath)
      } else if (entry.isFile()) {
        entries.push({ name: relPath, data: fs.readFileSync(full) })
      }
    }
  }
  walk(target, '')

  // Filter to forward-slash paths, drop any empty-string names
  const zipEntries = entries
    .filter(e => e.name)
    .map(e => ({ name: e.name.replace(/^\//, ''), data: e.data }))

  const zipBuf   = buildZip(zipEntries)
  const outName  = `${manifest.name}-${manifest.version}.zip`
  const outPath  = path.resolve(process.cwd(), outName)

  fs.writeFileSync(outPath, zipBuf)
  console.log(`Packed ${zipEntries.length} files → ${outPath}`)
}

// ── Subcommand: upgrade ───────────────────────────────────────────────────────

async function cmdUpgrade(zipArg) {
  if (!zipArg) die('upgrade requires a <zip> path')

  const zipPath = path.resolve(process.cwd(), zipArg)
  if (!fs.existsSync(zipPath)) die(`file not found: ${zipPath}`)

  const zipBuf  = fs.readFileSync(zipPath)
  const entries = parseZip(zipBuf)

  if (entries.length === 0) die('could not read any entries from zip')

  // Find manifest
  const manifestEntry = entries.find(e => e.name === 'artlab.json')
  if (!manifestEntry) die('artlab.json not found in zip')

  let manifest
  try {
    manifest = JSON.parse(manifestEntry.data.toString('utf8'))
  } catch (err) {
    die(`Failed to parse artlab.json: ${err.message}`)
  }

  const deps = manifest.dependencies ?? {}
  if (Object.keys(deps).length === 0) {
    console.log('No URL dependencies to upgrade.')
    return
  }

  console.log(`Upgrading ${Object.keys(deps).length} URL dependencies…`)

  // Re-fetch each dependency URL
  const fetched = {}
  for (const [libName, url] of Object.entries(deps)) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      console.log(`  skip  ${libName}  (not a URL)`)
      continue
    }
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      fetched[libName] = { url, buf }
      console.log(`  ok    ${libName}  ${url}`)
    } catch (err) {
      console.error(`  fail  ${libName}  ${url}  — ${err.message}`)
    }
  }

  // Update entries: replace embedded dep files and scan .art files for use url: refs
  // Convention: embedded deps are stored at deps/<libName>.js inside the zip
  const updatedEntries = entries.map(entry => {
    const libName = Object.keys(fetched).find(
      n => entry.name === `deps/${n}.js` || entry.name === `deps/${n}`
    )
    if (libName) {
      console.log(`  embed ${entry.name}`)
      return { name: entry.name, data: fetched[libName].buf }
    }
    return entry
  })

  // Add any deps that weren't already present as embedded files
  for (const [libName, { buf }] of Object.entries(fetched)) {
    const depPath = `deps/${libName}.js`
    if (!updatedEntries.find(e => e.name === depPath)) {
      updatedEntries.push({ name: depPath, data: buf })
      console.log(`  add   ${depPath}`)
    }
  }

  const newZip = buildZip(updatedEntries)
  fs.writeFileSync(zipPath, newZip)
  console.log(`\nUpdated zip written to: ${zipPath}`)
}

// ── Argument parsing & dispatch ───────────────────────────────────────────────

const argv = process.argv.slice(2)

if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
  usage()
  process.exit(0)
}

const [subcmd, ...rest] = argv

switch (subcmd) {
  case 'create':
    cmdCreate(rest[0])
    break

  case 'serve':
    cmdServe(rest[0])
    break

  case 'build':
    await cmdBuild(rest[0])
    break

  case 'pack':
    cmdPack(rest[0])
    break

  case 'upgrade':
    await cmdUpgrade(rest[0])
    break

  default:
    console.error(`artlab: unknown subcommand '${subcmd}'`)
    usage()
    process.exit(1)
}

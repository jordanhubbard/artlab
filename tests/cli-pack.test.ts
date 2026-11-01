import { expect, test } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import JSZip from 'jszip'

const cli = resolve('bin/artlab.ts')

test('CLI packs typed source and binary assets without changing bytes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'artlab-pack-'))
  try {
    const source = 'export const speed: number = 2\n'
    const binary = Buffer.from([0, 255, 128, 0, 42])
    writeFileSync(join(directory, 'artlab.json'), JSON.stringify({ name: 'round-trip', version: '1.0.0', entry: 'main.ts' }))
    writeFileSync(join(directory, 'main.ts'), source)
    writeFileSync(join(directory, 'sample.bin'), binary)
    execFileSync(process.execPath, [cli, 'pack', directory], { cwd: directory })
    const archive = join(directory, 'round-trip-1.0.0.zip')
    const zip = await JSZip.loadAsync(readFileSync(archive))
    expect(await zip.file('main.ts')?.async('string')).toBe(source)
    expect(await zip.file('sample.bin')?.async('nodebuffer')).toEqual(binary)
    expect(execFileSync(process.execPath, [cli, 'upgrade', archive], { cwd: directory, encoding: 'utf8' })).toContain('No URL dependencies')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('CLI rejects malformed manifest names and dependency values', () => {
  const directory = mkdtempSync(join(tmpdir(), 'artlab-manifest-'))
  try {
    for (const manifest of [{ name: 42, version: '1.0.0' }, { name: 'test', version: '1.0.0', dependencies: { library: 42 } }]) {
      writeFileSync(join(directory, 'artlab.json'), JSON.stringify(manifest))
      const result = spawnSync(process.execPath, [cli, 'pack', directory], { cwd: directory, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('artlab:')
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

import { test, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { EXAMPLES, EXAMPLE_ALIASES } from './catalog.ts'
import { parseManifest } from '../ide/WorkspaceData.ts'

test('every package is either a gallery lesson or a compatibility alias', () => {
  const names = EXAMPLES.map(ex => ex.name)
  expect(new Set(names).size).toBe(names.length)
  for (const directory of readdirSync('examples')) {
    if (!existsSync(`examples/${directory}/artlab.json`)) continue
    const manifest = parseManifest(readFileSync(`examples/${directory}/artlab.json`, 'utf8'))
    if (manifest.redirect) {
      expect(new Map(Object.entries(EXAMPLE_ALIASES)).get(directory)).toBe(manifest.redirect)
      expect(names).toContain(manifest.redirect)
      expect(names).not.toContain(directory)
    } else {
      const entry = EXAMPLES.find(ex => ex.name === directory)
      expect(entry, directory).toBeDefined()
      if (!entry) throw new Error(`Package is missing from the gallery: ${directory}`)
      expect(entry.entry).toBe(manifest.entry)
      expect(existsSync(`examples/${directory}/${entry.entry}`)).toBe(true)
      expect(!!entry.tutorial).toBe(existsSync(`examples/${directory}/tutorial.json`))
    }
  }
})

import { test, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { EXAMPLES, EXAMPLE_ALIASES } from './catalog.js'

test('every package is either a gallery lesson or a compatibility alias', () => {
  const names = EXAMPLES.map(ex => ex.name)
  expect(new Set(names).size).toBe(names.length)
  for (const directory of readdirSync('examples')) {
    if (!existsSync(`examples/${directory}/artlab.json`)) continue
    const manifest = JSON.parse(readFileSync(`examples/${directory}/artlab.json`, 'utf8'))
    if (manifest.redirect) {
      expect(EXAMPLE_ALIASES[directory]).toBe(manifest.redirect)
      expect(names).toContain(manifest.redirect)
      expect(names).not.toContain(directory)
    } else {
      const entry = EXAMPLES.find(ex => ex.name === directory)
      expect(entry, directory).toBeDefined()
      expect(entry.entry).toBe(manifest.entry)
      expect(existsSync(`examples/${directory}/${entry.entry}`)).toBe(true)
      expect(!!entry.tutorial).toBe(existsSync(`examples/${directory}/tutorial.json`))
    }
  }
})

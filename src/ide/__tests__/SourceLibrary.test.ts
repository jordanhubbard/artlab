// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { SourceLibrary } from '../SourceLibrary.ts'

afterEach(() => vi.unstubAllGlobals())

test('loads a typed example package with a workspace-relative entry', async () => {
  const library = new SourceLibrary({
    '/examples/demo/artlab.json': async () => '{"name":"demo","entry":"main.ts"}',
    '/examples/demo/main.ts': async () => 'export const value: number = 1',
  })
  const result = await library.example('demo')
  expect(result.manifest.entry).toBe('examples/demo/main.ts')
  expect(result.artFiles.get('examples/demo/main.ts')).toContain('value: number')
  expect(result.artFiles.has('examples/demo/artlab.json')).toBe(false)
  expect(result.artFiles.has('artlab.json')).toBe(true)
})

test('rejects missing and malformed manifest entries before compilation', async () => {
  await expect(new SourceLibrary({}).example('missing')).rejects.toThrow('Manifest not found')
  for (const [source, message] of [
    ['null', 'JSON object'], ['{}', 'string entry'], ['{"entry":42}', 'string entry'],
    ['{"name":false,"entry":"main.ts"}', '"name"'],
  ]) {
    const library = new SourceLibrary({ '/examples/demo/artlab.json': async () => source })
    await expect(library.example('demo')).rejects.toThrow(message)
  }
})

test('rejects malformed asset catalogs before fetching asset paths', async () => {
  const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ['examples/demo/assets/a.png', 42] })
  vi.stubGlobal('fetch', request)
  const library = new SourceLibrary({ '/examples/demo/main.ts': async () => '' })
  await expect(library.assetsFor('examples/demo/main.ts')).rejects.toThrow('Invalid example asset catalog')
  expect(request).toHaveBeenCalledTimes(1)
})

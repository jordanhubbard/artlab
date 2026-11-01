import { afterEach, expect, test, vi } from 'vitest'
import { AssetManager } from './AssetManager.ts'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

test('loads package text, reports completion, and reuses the loaded asset', async () => {
  const readAsset = vi.fn(async () => new Blob(['scene notes']))
  const progress = vi.fn()
  const manager = new AssetManager()
  manager.setPackageReader({ readAsset })
  manager.register('notes.txt', 'text')
  await manager.loadAll(progress)
  expect(manager.get('notes.txt')).toBe('scene notes')
  expect(await manager.load('notes.txt', 'text')).toBe('scene notes')
  expect(readAsset).toHaveBeenCalledTimes(1)
  expect(progress).toHaveBeenCalledWith({ loaded: 1, total: 1, current: 'notes.txt' })
})

test('failed requests remain unavailable and report no completed assets', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const progress = vi.fn()
  const manager = new AssetManager().register('missing.txt', 'text')
  await manager.loadAll(progress)
  expect(manager.get('missing.txt')).toBeNull()
  expect(progress).toHaveBeenCalledWith({ loaded: 0, total: 1, current: 'missing.txt' })
  expect(warning).toHaveBeenCalledWith(expect.stringContaining('missing.txt'), 'HTTP 404')
})

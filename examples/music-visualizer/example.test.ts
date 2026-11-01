// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initializeAsync, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./music-visualizer.ts')

vi.mock('three', async () => await vi.importActual('three'))

function setupMediaMocks() {
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockRejectedValue(new Error('no mic')) },
    configurable: true, writable: true,
  })
  vi.stubGlobal('AudioContext', undefined)
  vi.stubGlobal('webkitAudioContext', undefined)
}

describe('music-visualizer', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    setupMediaMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./music-visualizer.ts'))
  })

  it('setup() completes without throwing', async () => {
    ctx = await initializeAsync(setup, base)
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('creates 3 ring meshes and particle system', async () => {
    ctx = await initializeAsync(setup, base)
    expect(ctx._rings).toHaveLength(3)
    expect(ctx._particles).toBeInstanceOf(Three.Points)
  })

  it('update() runs multiple frames with sine fallback', async () => {
    ctx = await initializeAsync(setup, base)
    for (const t of [0, 0.016, 0.5, 1.0, 2.0]) {
      ctx.elapsed = t
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('rings scale changes during update', async () => {
    ctx = await initializeAsync(setup, base)
    ctx.elapsed = 0
    update(ctx, 0.016)
    const s1 = ctx._rings[0].mesh.scale.x
    ctx.elapsed = 0.5
    update(ctx, 0.016)
    const s2 = ctx._rings[0].mesh.scale.x
    expect(s1).not.toBe(s2)
  })

  it('teardown() removes all objects', async () => {
    ctx = await initializeAsync(setup, base)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._particles)
  })
})

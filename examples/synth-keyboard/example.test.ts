// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initializeAsync, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./synth-keyboard.ts')

vi.mock('three', async () => await vi.importActual('three'))
vi.mock('tone', () => ({
  PolySynth: vi.fn(function () {
    return {
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      connect: vi.fn().mockReturnThis(),
      dispose: vi.fn(),
    }
  }),
  Synth: vi.fn(function () {}),
  Reverb: vi.fn(function () {
    return {
      toDestination: vi.fn().mockReturnThis(),
      dispose: vi.fn(),
    }
  }),
  start: vi.fn(),
}))

describe('synth-keyboard', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./synth-keyboard.ts'))
  })

  it('setup() completes without throwing', async () => {
    ctx = await initializeAsync(setup, base)
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('creates key meshes and particle system', async () => {
    ctx = await initializeAsync(setup, base)
    expect(ctx._keyMeshes.length).toBeGreaterThan(8) // 8 white + black keys
    expect(ctx._particleSystem).toBeInstanceOf(Three.Points)
  })

  it('update() runs multiple frames', async () => {
    ctx = await initializeAsync(setup, base)
    for (const t of [0, 0.016, 0.5, 1.0]) {
      ctx.elapsed = t
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() removes all objects and disposes Tone nodes', async () => {
    ctx = await initializeAsync(setup, base)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._particleSystem)
    expect(ctx._synth.dispose).toHaveBeenCalled()
    expect(ctx._reverb.dispose).toHaveBeenCalled()
  })
})

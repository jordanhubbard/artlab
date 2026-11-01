// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./fluid-2d.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('fluid-2d', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./fluid-2d.ts'))
  })

  it('setup() completes without throwing', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates density and velocity grids', () => {
    ctx = initialize(setup, base)
    const size = 98 * 98 // (96 + 2)^2
    expect(ctx._u).toBeInstanceOf(Float32Array)
    expect(ctx._v).toBeInstanceOf(Float32Array)
    expect(ctx._d).toBeInstanceOf(Float32Array)
    expect(ctx._u.length).toBe(size)
    expect(ctx._d.length).toBe(size)
    const seeded = ctx._d.reduce((s, v) => s + v, 0)
    expect(seeded).toBeGreaterThan(0)
  })

  it('setup() creates a DataTexture and quad', () => {
    ctx = initialize(setup, base)
    expect(ctx._texture).toBeInstanceOf(Three.DataTexture)
    expect(ctx._quad).toBeInstanceOf(Three.Mesh)
    expect(ctx._texData).toBeInstanceOf(Uint8Array)
    expect(ctx._texData.length).toBe(96 * 96 * 4)
  })

  it('update() runs multiple frames without throwing', () => {
    ctx = initialize(setup, base)
    for (let i = 0; i < 10; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('density field responds to mouse injection', () => {
    ctx = initialize(setup, base)
    // Simulate mouse drag in center
    ctx._mouseDown = true
    ctx._mouseX = 0.5
    ctx._mouseY = 0.5
    ctx._pmouseX = 0.48
    ctx._pmouseY = 0.5
    update(ctx, 0.016)
    // Check that some density was injected
    const totalDensity = ctx._d.reduce((s, v) => s + v, 0)
    expect(totalDensity).toBeGreaterThan(0)
  })

  it('teardown() removes quad and disposes texture', () => {
    ctx = initialize(setup, base)
    const disposeSpy = vi.spyOn(ctx._texture, 'dispose')
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._quad)
    expect(disposeSpy).toHaveBeenCalled()
  })
})

// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./recursive-spirals.ts')


vi.mock('three', async () => await vi.importActual('three'))

describe('recursive-spirals', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    base = makeSpiedContext()
    mod = await import('./recursive-spirals.ts')
  })

  it('setup() does not throw', () => {
    expect(() => (ctx = initialize(mod.setup, base))).not.toThrow()
  })

  it('setup() calls ctx.add at least once', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() calls ctx.setBloom', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates _points', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._points).toBeInstanceOf(Three.Points)
  })

  it('setup() creates _basePositions', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._basePositions).toBeInstanceOf(Float32Array)
    expect(ctx._basePositions.length).toBeGreaterThan(0)
  })

  it('setup() stores _particleCount', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._particleCount).toBeGreaterThan(0)
  })


  it('update() runs 3 frames without throwing', () => {
    ctx = initialize(mod.setup, base)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('teardown() does not throw', () => {
    ctx = initialize(mod.setup, base)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() calls ctx.remove', () => {
    ctx = initialize(mod.setup, base)
    mod.teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })


})

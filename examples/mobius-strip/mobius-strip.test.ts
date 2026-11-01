// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./mobius-strip.ts')


vi.mock('three', async () => await vi.importActual('three'))

describe('mobius-strip', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    base = makeSpiedContext()
    mod = await import('./mobius-strip.ts')
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

  it('setup() creates _strip mesh', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._strip).toBeInstanceOf(Three.Mesh)
  })

  it('setup() creates _wire', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._wire).toBeDefined()
  })

  it('setup() creates particle arrays', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._particleU).toBeInstanceOf(Float32Array)
    expect(ctx._particleV).toBeInstanceOf(Float32Array)
    expect(ctx._particleSpeed).toBeInstanceOf(Float32Array)
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

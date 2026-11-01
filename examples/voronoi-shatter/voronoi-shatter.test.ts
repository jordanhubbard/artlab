// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./voronoi-shatter.ts')


vi.mock('three', async () => await vi.importActual('three'))

describe('voronoi-shatter', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    base = makeSpiedContext()
    mod = await import('./voronoi-shatter.ts')
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

  it('setup() creates _seeds array', () => {
    ctx = initialize(mod.setup, base)
    expect(Array.isArray(ctx._seeds)).toBe(true)
  })

  it('setup() creates _cellMeshes array', () => {
    ctx = initialize(mod.setup, base)
    expect(Array.isArray(ctx._cellMeshes)).toBe(true)
  })

  it('setup() initializes _shattered flag', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._shattered).toBe(false)
  })

  it('setup() creates _raycaster', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._raycaster).toBeInstanceOf(Three.Raycaster)
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

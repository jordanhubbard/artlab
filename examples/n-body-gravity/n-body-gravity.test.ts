// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./n-body-gravity.ts')
vi.mock('../../src/physics/Physics.ts', async () => {
  const Three = await import('three')
  return {
    body: vi.fn((m) => ({ mass: m, position: new Three.Vector3(), velocity: new Three.Vector3() })),
    integrate: vi.fn(),
    applyForce: vi.fn(),
  }
})

vi.mock('three', async () => await vi.importActual('three'))

describe('n-body-gravity', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    base = makeSpiedContext()
    mod = await import('./n-body-gravity.ts')
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

  it('setup() creates _bodies array', () => {
    ctx = initialize(mod.setup, base)
    expect(Array.isArray(ctx._bodies)).toBe(true)
    expect(ctx._bodies.length).toBeGreaterThan(0)
  })

  it('setup() creates _clickPlane and _raycaster', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._clickPlane).toBeDefined()
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

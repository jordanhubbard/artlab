// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./n-body-gravity.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('n-body-gravity', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./n-body-gravity.ts'))
  })

  it('setup() completes without throwing', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates ~30 initial bodies with trails', () => {
    ctx = initialize(setup, base)
    expect(Array.isArray(ctx._bodies)).toBe(true)
    expect(ctx._bodies.length).toBe(30)
    for (const b of ctx._bodies) {
      expect(b.phys).toBeDefined()
      expect(b.mesh).toBeInstanceOf(Three.Mesh)
      expect(b.trail).toBeInstanceOf(Three.Line)
      expect(b.alive).toBe(true)
    }
  })

  it('update() runs multiple frames without throwing', () => {
    ctx = initialize(setup, base)
    for (let i = 0; i < 10; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('body positions change after update', () => {
    ctx = initialize(setup, base)
    const before = ctx._bodies[0].phys.position.clone()
    update(ctx, 0.016)
    update(ctx, 0.016)
    expect(ctx._bodies[0].phys.position.distanceTo(before)).toBeGreaterThan(0)
  })

  it('bodies have physics mass and velocity', () => {
    ctx = initialize(setup, base)
    for (const b of ctx._bodies) {
      expect(b.phys.mass).toBeGreaterThan(0)
      expect(b.phys.velocity).toBeInstanceOf(Three.Vector3)
    }
  })

  it('teardown() removes all bodies and cleans up', () => {
    ctx = initialize(setup, base)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
    // Should have removed bodies + trails + click plane
    const removeCount = ctx.remove.mock.calls.length
    expect(removeCount).toBeGreaterThanOrEqual(30 * 2 + 1) // bodies + trails + clickPlane
  })
})

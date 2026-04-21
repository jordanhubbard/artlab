// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx(overrides = {}) {
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new Three.Vector3(0, 0, 50),
    lookAt: vi.fn(), aspect: 1, fov: 60,
    updateProjectionMatrix: vi.fn(),
  }
  return {
    Three, scene, camera,
    renderer: { domElement: document.createElement('canvas'), shadowMap: { enabled: false }, setSize: vi.fn() },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('n-body-gravity', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./n-body-gravity.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates ~30 initial bodies with trails', () => {
    setup(ctx)
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
    setup(ctx)
    for (let i = 0; i < 10; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('body positions change after update', () => {
    setup(ctx)
    const before = ctx._bodies[0].phys.position.clone()
    update(ctx, 0.016)
    update(ctx, 0.016)
    expect(ctx._bodies[0].phys.position.distanceTo(before)).toBeGreaterThan(0)
  })

  it('bodies have physics mass and velocity', () => {
    setup(ctx)
    for (const b of ctx._bodies) {
      expect(b.phys.mass).toBeGreaterThan(0)
      expect(b.phys.velocity).toBeInstanceOf(Three.Vector3)
    }
  })

  it('teardown() removes all bodies and cleans up', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
    // Should have removed bodies + trails + click plane
    const removeCount = ctx.remove.mock.calls.length
    expect(removeCount).toBeGreaterThanOrEqual(30 * 2 + 1) // bodies + trails + clickPlane
  })
})

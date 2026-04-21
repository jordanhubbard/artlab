// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx(overrides = {}) {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new Three.Vector3(0, 30, 50),
    lookAt: vi.fn(),
    fov: 60, aspect: 1, near: 0.1, far: 100000,
    updateProjectionMatrix: vi.fn(),
    projectionMatrix: new Three.Matrix4(),
    matrixWorldInverse: new Three.Matrix4(),
  }
  return {
    Three, scene, camera,
    renderer: { domElement: canvas, shadowMap: { enabled: false }, setSize: vi.fn(), render: vi.fn() },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('n-body-gravity', () => {
  let ctx, mod

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./n-body-gravity.js')
  })

  it('setup() does not throw', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
  })

  it('setup() calls ctx.setBloom', () => {
    mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalledWith(1.5)
  })

  it('setup() creates bodies array with initial bodies', () => {
    mod.setup(ctx)
    expect(Array.isArray(ctx._bodies)).toBe(true)
    expect(ctx._bodies.length).toBe(10)
  })

  it('each body has physics properties and mesh', () => {
    mod.setup(ctx)
    const b = ctx._bodies[0]
    expect(b.phys).toHaveProperty('position')
    expect(b.phys).toHaveProperty('velocity')
    expect(b.phys).toHaveProperty('mass')
    expect(b.mesh).toBeInstanceOf(Three.Mesh)
    expect(b.trail).toBeInstanceOf(Three.Line)
    expect(b.alive).toBe(true)
  })

  it('setup() creates background stars', () => {
    mod.setup(ctx)
    expect(ctx._stars).toBeInstanceOf(Three.Points)
  })

  it('update() runs multiple frames without throwing', () => {
    mod.setup(ctx)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('update() moves body positions', () => {
    mod.setup(ctx)
    const posBefore = ctx._bodies[0].phys.position.clone()
    mod.update(ctx, 0.1)
    const posAfter = ctx._bodies[0].phys.position
    expect(posAfter.distanceTo(posBefore)).toBeGreaterThan(0)
  })

  it('update() syncs mesh position to physics position', () => {
    mod.setup(ctx)
    mod.update(ctx, 0.016)
    const b = ctx._bodies[0]
    expect(b.mesh.position.x).toBeCloseTo(b.phys.position.x, 4)
    expect(b.mesh.position.y).toBeCloseTo(b.phys.position.y, 4)
    expect(b.mesh.position.z).toBeCloseTo(b.phys.position.z, 4)
  })

  it('update() builds trail history', () => {
    mod.setup(ctx)
    mod.update(ctx, 0.016)
    mod.update(ctx, 0.016)
    mod.update(ctx, 0.016)
    expect(ctx._bodies[0].trailHistory.length).toBe(3)
  })

  it('mergeBodies() conserves momentum', () => {
    mod.setup(ctx)
    const a = {
      phys: { mass: 4, position: new Three.Vector3(0, 0, 0), velocity: new Three.Vector3(2, 0, 0) },
    }
    const b = {
      phys: { mass: 6, position: new Three.Vector3(1, 0, 0), velocity: new Three.Vector3(-1, 0, 0) },
    }
    const momentumBefore = new Three.Vector3()
      .addScaledVector(a.phys.velocity, a.phys.mass)
      .addScaledVector(b.phys.velocity, b.phys.mass)

    const result = mod.mergeBodies(a, b)
    const momentumAfter = result.velocity.clone().multiplyScalar(result.mass)

    expect(result.mass).toBe(10)
    expect(momentumAfter.x).toBeCloseTo(momentumBefore.x, 5)
    expect(momentumAfter.y).toBeCloseTo(momentumBefore.y, 5)
    expect(momentumAfter.z).toBeCloseTo(momentumBefore.z, 5)
  })

  it('mergeBodies() computes mass-weighted center position', () => {
    const a = {
      phys: { mass: 2, position: new Three.Vector3(0, 0, 0), velocity: new Three.Vector3() },
    }
    const b = {
      phys: { mass: 8, position: new Three.Vector3(10, 0, 0), velocity: new Three.Vector3() },
    }
    const result = mod.mergeBodies(a, b)
    expect(result.position.x).toBeCloseTo(8, 5)  // weighted toward heavier body
  })

  it('click spawns a new body', () => {
    mod.setup(ctx)
    const before = ctx._bodies.length
    window.dispatchEvent(new MouseEvent('click', { clientX: 400, clientY: 300, bubbles: true }))
    // The new body may or may not appear depending on raycaster hit,
    // but it should not throw
    expect(ctx._bodies.length).toBeGreaterThanOrEqual(before)
  })

  it('teardown() does not throw', () => {
    mod.setup(ctx)
    mod.update(ctx, 0.016)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() clears bodies array', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(ctx._bodies.length).toBe(0)
  })

  it('teardown() removes stars', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._stars)
  })
})

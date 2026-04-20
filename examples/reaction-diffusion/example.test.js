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

describe('reaction-diffusion', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./reaction-diffusion.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates 256×256 A and B buffers with center seeded', () => {
    setup(ctx)
    expect(ctx._A).toBeInstanceOf(Float32Array)
    expect(ctx._B).toBeInstanceOf(Float32Array)
    expect(ctx._A.length).toBe(256 * 256)
    // Most of A is 1.0 (initialized)
    const sumA = ctx._A.reduce((s, v) => s + v, 0)
    expect(sumA).toBeGreaterThan(256 * 256 * 0.9)
    // Center has nonzero B
    const cx = 128, cy = 128
    const ci = cy * 256 + cx
    expect(ctx._B[ci]).toBeGreaterThan(0)
  })

  it('update() evolves the simulation over several frames', () => {
    setup(ctx)
    const initB = ctx._B[128 * 256 + 128]
    update(ctx, 0.016)
    update(ctx, 0.016)
    update(ctx, 0.016)
    // B values should have spread from center
    expect(ctx._B[128 * 256 + 128]).not.toBeCloseTo(initB, 5)
  })

  it('update() does not throw over 10 frames', () => {
    setup(ctx)
    for (let i = 0; i < 10; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() removes quad and disposes texture', () => {
    setup(ctx)
    const disposeSpy = vi.spyOn(ctx._texture, 'dispose')
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._quad)
    expect(disposeSpy).toHaveBeenCalled()
  })
})

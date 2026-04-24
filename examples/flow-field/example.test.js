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
    setHelp:  vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('flow-field', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./flow-field.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates Points with position and color attributes', () => {
    setup(ctx)
    expect(ctx._points).toBeInstanceOf(Three.Points)
    const geo = ctx._points.geometry
    expect(geo.attributes.position).toBeDefined()
    expect(geo.attributes.color).toBeDefined()
    expect(geo.attributes.position.count).toBe(4000)
    expect(geo.attributes.color.count).toBe(4000)
  })

  it('setup() uses additive blending', () => {
    setup(ctx)
    expect(ctx._points.material.blending).toBe(Three.AdditiveBlending)
  })

  it('update() runs multiple frames without throwing', () => {
    setup(ctx)
    for (let i = 0; i < 20; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('particle positions change after update', () => {
    setup(ctx)
    const posBefore = ctx._px[0]
    update(ctx, 0.016)
    update(ctx, 0.016)
    expect(ctx._px[0]).not.toBe(posBefore)
  })

  it('particles respawn when alpha fades out', () => {
    setup(ctx)
    // Force a particle to fade
    ctx._alpha[0] = 0.001
    const oldX = ctx._px[0]
    update(ctx, 0.016)
    // Alpha should have been reset (respawned)
    expect(ctx._alpha[0]).toBeGreaterThan(0.5)
  })

  it('teardown() removes points and disposes', () => {
    setup(ctx)
    const geoDispose = vi.spyOn(ctx._points.geometry, 'dispose')
    const matDispose = vi.spyOn(ctx._points.material, 'dispose')
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._points)
    expect(geoDispose).toHaveBeenCalled()
    expect(matDispose).toHaveBeenCalled()
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'
import { FlowParticles } from './FlowParticles.js'

const points = ctx => ctx.add.mock.calls.find(([obj]) => obj.isPoints)[0]

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
    expect(points(ctx)).toBeInstanceOf(Three.Points)
    const geo = points(ctx).geometry
    expect(geo.attributes.position).toBeDefined()
    expect(geo.attributes.color).toBeDefined()
    expect(geo.attributes.position.count).toBe(4000)
    expect(geo.attributes.color.count).toBe(4000)
  })

  it('setup() uses additive blending', () => {
    setup(ctx)
    expect(points(ctx).material.blending).toBe(Three.AdditiveBlending)
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
    const posBefore = points(ctx).geometry.attributes.position.array[0]
    update(ctx, 0.016)
    update(ctx, 0.016)
    expect(points(ctx).geometry.attributes.position.array[0]).not.toBe(posBefore)
  })

  it('particles respawn when alpha fades out', () => {
    const field = new FlowParticles({ count: 4 })
    field.alpha[0] = 0.001
    field.update(0.016, 0)
    expect(field.alpha[0]).toBeGreaterThan(0.5)
    expect(Math.abs(field.positions[0])).toBeLessThanOrEqual(50)
    field.dispose()
  })

  it('teardown() removes points and disposes', () => {
    setup(ctx)
    const geoDispose = vi.spyOn(points(ctx).geometry, 'dispose')
    const matDispose = vi.spyOn(points(ctx).material, 'dispose')
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(points(ctx))
    expect(geoDispose).toHaveBeenCalled()
    expect(matDispose).toHaveBeenCalled()
  })
})

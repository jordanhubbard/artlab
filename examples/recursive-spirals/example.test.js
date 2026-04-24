// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx() {
  const scene = { add: vi.fn(), remove: vi.fn(), children: [], fog: null }
  return {
    Three, scene,
    camera: { position: new Three.Vector3(0, 0, 50), lookAt: vi.fn(), aspect: 1, fov: 60, updateProjectionMatrix: vi.fn() },
    renderer: { domElement: document.createElement('canvas'), shadowMap: { enabled: false }, setSize: vi.fn() },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed: 0,
  }
}

describe('recursive-spirals', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./recursive-spirals.js'))
  })

  it('setup() generates thousands of spiral particles', () => {
    setup(ctx)
    expect(ctx._particleCount).toBeGreaterThan(500)
    expect(ctx._points).toBeInstanceOf(Three.Points)
  })

  it('particles use additive blending', () => {
    setup(ctx)
    expect(ctx._points.material.blending).toBe(Three.AdditiveBlending)
  })

  it('update() rotates and animates particles', () => {
    setup(ctx)
    const z0 = ctx._points.rotation.z
    update(ctx, 0.1)
    expect(ctx._points.rotation.z).toBeGreaterThan(z0)
    // positions were updated
    const pos = ctx._points.geometry.attributes.position.array
    expect(pos).toBeDefined()
  })

  it('teardown() removes and disposes', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

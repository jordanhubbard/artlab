// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx(overrides = {}) {
  const scene = {
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
  }
  const camera = {
    position: new Three.Vector3(0, 0, 5),
    lookAt: vi.fn(),
    aspect: 1, fov: 60,
    updateProjectionMatrix: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
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

describe('shader-playground', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./shader-playground.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates quad with ShaderMaterial and uniforms', () => {
    setup(ctx)
    expect(ctx.scene.children[0]).toBeInstanceOf(Three.Mesh)
    expect(ctx.scene.children[0].material).toBeInstanceOf(Three.ShaderMaterial)
    expect(ctx.scene.children[0].material.uniforms.uTime).toBeDefined()
    expect(ctx.scene.children[0].material.uniforms.uResolution).toBeDefined()
  })

  it('update() advances uTime uniform', () => {
    setup(ctx)
    ctx.elapsed = 1.5
    update(ctx, 0.016)
    expect(ctx.scene.children[0].material.uniforms.uTime.value).toBe(1.5)
  })

  it('update() runs 5 frames without throwing', () => {
    setup(ctx)
    for (let i = 0; i < 5; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() removes and disposes its shader surface', async () => {
    setup(ctx)
    const quad = ctx.scene.children[0]
    const geometry = vi.spyOn(quad.geometry, 'dispose')
    const material = vi.spyOn(quad.material, 'dispose')
    await teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(quad)
    expect(geometry).toHaveBeenCalledTimes(1)
    expect(material).toHaveBeenCalledTimes(1)
  })
})

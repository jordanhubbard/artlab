// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx(overrides = {}) {
  const container = document.createElement('div')
  const canvas    = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left:0, top:0, width:800, height:600 })
  container.appendChild(canvas)
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new Three.Vector3(0,2,6), lookAt: vi.fn(),
    fov: 60, aspect: 1, near: 0.1, far: 100000,
    updateProjectionMatrix: vi.fn(),
    projectionMatrix: new Three.Matrix4(),
    matrixWorldInverse: new Three.Matrix4(),
  }
  return {
    Three, scene, camera,
    renderer: { domElement: canvas, shadowMap:{enabled:false}, setSize: vi.fn(), render: vi.fn() },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('physics-particles', () => {
  let ctx, mod

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./physics-particles.js')
  })

  it('setup() does not throw', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
  })

  it('setup() calls ctx.setBloom', () => {
    mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalledWith(1.2)
  })

  it('setup() creates Physics body pool in ctx._particles', () => {
    mod.setup(ctx)
    expect(Array.isArray(ctx._particles)).toBe(true)
    expect(ctx._particles.length).toBeGreaterThan(0)
    expect(ctx._particles[0]).toHaveProperty('position')
    expect(ctx._particles[0]).toHaveProperty('velocity')
  })

  it('setup() creates ctx._ground mesh', () => {
    mod.setup(ctx)
    expect(ctx._ground).toBeInstanceOf(Three.Mesh)
  })

  it('setup() creates ctx._instanced InstancedMesh', () => {
    mod.setup(ctx)
    expect(ctx._instanced).toBeInstanceOf(Three.InstancedMesh)
  })

  it('update() runs 3 frames without throwing', () => {
    mod.setup(ctx)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('click does not throw', () => {
    mod.setup(ctx)
    expect(() => {
      window.dispatchEvent(new MouseEvent('click', { clientX:400, clientY:300, bubbles:true }))
    }).not.toThrow()
  })

  it('teardown() does not throw', () => {
    mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() removes ground from scene', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._ground)
  })
})

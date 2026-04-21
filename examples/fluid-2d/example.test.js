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

describe('fluid-2d', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./fluid-2d.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates density and velocity grids', () => {
    setup(ctx)
    const size = 98 * 98 // (96 + 2)^2
    expect(ctx._u).toBeInstanceOf(Float32Array)
    expect(ctx._v).toBeInstanceOf(Float32Array)
    expect(ctx._d).toBeInstanceOf(Float32Array)
    expect(ctx._u.length).toBe(size)
    expect(ctx._d.length).toBe(size)
  })

  it('setup() creates a DataTexture and quad', () => {
    setup(ctx)
    expect(ctx._texture).toBeInstanceOf(Three.DataTexture)
    expect(ctx._quad).toBeInstanceOf(Three.Mesh)
    expect(ctx._texData).toBeInstanceOf(Uint8Array)
    expect(ctx._texData.length).toBe(96 * 96 * 4)
  })

  it('update() runs multiple frames without throwing', () => {
    setup(ctx)
    for (let i = 0; i < 10; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('density field responds to mouse injection', () => {
    setup(ctx)
    // Simulate mouse drag in center
    ctx._mouseDown = true
    ctx._mouseX = 0.5
    ctx._mouseY = 0.5
    ctx._pmouseX = 0.48
    ctx._pmouseY = 0.5
    update(ctx, 0.016)
    // Check that some density was injected
    const totalDensity = ctx._d.reduce((s, v) => s + v, 0)
    expect(totalDensity).toBeGreaterThan(0)
  })

  it('teardown() removes quad and disposes texture', () => {
    setup(ctx)
    const disposeSpy = vi.spyOn(ctx._texture, 'dispose')
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._quad)
    expect(disposeSpy).toHaveBeenCalled()
  })
})

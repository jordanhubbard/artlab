// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx(overrides = {}) {
  const scene = { add: vi.fn(), remove: vi.fn(), children: [], fog: null }
  const camera = {
    position: new Three.Vector3(0, 0, 50),
    lookAt: vi.fn(), aspect: 1, fov: 60,
    updateProjectionMatrix: vi.fn(),
  }
  return {
    Three, scene, camera,
    renderer: {
      domElement: document.createElement('canvas'),
      shadowMap: { enabled: false },
      setSize: vi.fn(),
      setClearColor: vi.fn(),
    },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('terrain-flyover', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./terrain-flyover.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates terrain mesh with vertex colors', () => {
    setup(ctx)
    expect(ctx._terrain).toBeDefined()
    expect(ctx._terrain).toBeInstanceOf(Three.Mesh)
    expect(ctx._terrain.geometry.attributes.color).toBeDefined()
  })

  it('update() runs 3 frames without throwing', () => {
    setup(ctx)
    const frames = [0, 0.016, 0.032]
    for (const elapsed of frames) {
      ctx.elapsed = elapsed
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('noise offset advances each frame', () => {
    setup(ctx)
    const before = ctx._offset
    update(ctx, 0.1)
    expect(ctx._offset).toBeGreaterThan(before)
  })

  it('teardown() removes terrain and clears fog', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._terrain)
    expect(ctx.scene.fog).toBeNull()
  })
})

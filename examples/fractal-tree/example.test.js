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

describe('fractal-tree', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./fractal-tree.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates root group and branch meshes', () => {
    setup(ctx)
    expect(ctx._root).toBeInstanceOf(Three.Group)
    expect(Array.isArray(ctx._branches)).toBe(true)
    expect(ctx._branches.length).toBeGreaterThan(0)
    for (const b of ctx._branches) {
      expect(b).toBeInstanceOf(Three.Mesh)
      expect(typeof b.userData.depth).toBe('number')
    }
  })

  it('update() animates without throwing over several frames', () => {
    setup(ctx)
    for (let i = 0; i < 5; i++) {
      ctx.elapsed = i * 0.5
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('update() modifies root rotation', () => {
    setup(ctx)
    ctx.elapsed = 0
    update(ctx, 0.016)
    const rz = ctx._root.rotation.z
    ctx.elapsed = 2.0
    update(ctx, 0.016)
    // Rotation should change with time
    expect(ctx._root.rotation.z).not.toBeCloseTo(rz, 10)
  })

  it('teardown() removes all scene objects', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
    expect(ctx.remove.mock.calls.length).toBeGreaterThanOrEqual(ctx._objects.length)
  })
})

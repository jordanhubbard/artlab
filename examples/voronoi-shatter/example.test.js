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
    elapsed: 0,
  }
}

describe('voronoi-shatter', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./voronoi-shatter.js'))
  })

  it('setup() completes and creates initial cells', () => {
    setup(ctx)
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx._cellMeshes.length).toBeGreaterThan(0)
    expect(ctx._seeds.length).toBe(8)
  })

  it('cells are ExtrudeGeometry meshes', () => {
    setup(ctx)
    for (const m of ctx._cellMeshes) {
      expect(m).toBeInstanceOf(Three.Mesh)
    }
  })

  it('update() without shatter does nothing', () => {
    setup(ctx)
    const y0 = ctx._cellMeshes[0].position.y
    update(ctx, 0.016)
    expect(ctx._cellMeshes[0].position.y).toBe(y0)
  })

  it('update() after shatter moves cells', () => {
    setup(ctx)
    ctx._shattered = true
    for (const p of ctx._physics) {
      p.vx = 1; p.vy = 5; p.vz = 1
      p.rx = 1; p.ry = 1; p.rz = 1
    }
    update(ctx, 0.1)
    expect(ctx._cellMeshes[0].position.y).not.toBe(0)
  })

  it('teardown() removes all cells', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

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

describe('penrose-tiles', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./penrose-tiles.js'))
  })

  it('setup() creates tile meshes from deflation', () => {
    setup(ctx)
    expect(ctx._tileMeshes.length).toBeGreaterThan(100)
    expect(ctx._triangles.length).toBe(ctx._tileMeshes.length)
  })

  it('tiles start below screen for rise animation', () => {
    setup(ctx)
    expect(ctx._tileMeshes[0].position.y).toBe(-5)
  })

  it('update() advances animation and cycles colors', () => {
    setup(ctx)
    update(ctx, 0.1)
    expect(ctx._animTime).toBeGreaterThan(0)
    expect(ctx._tileMeshes[0].position.y).toBeGreaterThan(-5)
  })

  it('has both thin and thick triangle types', () => {
    setup(ctx)
    const types = new Set(ctx._triangles.map(t => t.type))
    expect(types.has(0)).toBe(true)
    expect(types.has(1)).toBe(true)
  })

  it('teardown() cleans up all tile meshes', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(ctx._tileMeshes.length + 2) // tiles + lights
  })
})

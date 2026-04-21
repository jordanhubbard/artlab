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

describe('marble-run', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./marble-run.js'))
  })

  it('setup() creates ramps and bowl', () => {
    setup(ctx)
    expect(ctx._rampMeshes.length).toBe(6)
    expect(ctx._bowl).toBeInstanceOf(Three.Mesh)
    expect(ctx._marbles).toHaveLength(0)
  })

  it('update() spawns marbles over time', () => {
    setup(ctx)
    // Simulate enough time to spawn
    for (let i = 0; i < 100; i++) update(ctx, 0.02)
    expect(ctx._marbles.length).toBeGreaterThan(0)
  })

  it('marbles have physics (fall with gravity)', () => {
    setup(ctx)
    // Force spawn
    ctx._spawnTimer = 10
    update(ctx, 0.016)
    expect(ctx._marbles.length).toBe(1)
    const y0 = ctx._marbles[0].pos.y
    update(ctx, 0.1)
    expect(ctx._marbles[0].pos.y).toBeLessThan(y0)
  })

  it('marbles have metallic shiny material', () => {
    setup(ctx)
    ctx._spawnTimer = 10
    update(ctx, 0.016)
    expect(ctx._marbles[0].mesh.material.metalness).toBeGreaterThan(0.5)
  })

  it('teardown() cleans up everything', () => {
    setup(ctx)
    ctx._spawnTimer = 10
    update(ctx, 0.016)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

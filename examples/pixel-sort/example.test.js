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

describe('pixel-sort', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./pixel-sort.js'))
  })

  it('setup() creates texture quad', () => {
    setup(ctx)
    expect(ctx._quad).toBeInstanceOf(Three.Mesh)
    expect(ctx._pixelData.length).toBe(256 * 256 * 4)
  })

  it('pixel data is populated on setup', () => {
    setup(ctx)
    // Check that at least some pixels are non-zero
    let nonZero = 0
    for (let i = 0; i < 100; i++) {
      if (ctx._pixelData[i * 4] > 0) nonZero++
    }
    expect(nonZero).toBeGreaterThan(0)
  })

  it('update() sorts rows and marks texture for update', () => {
    setup(ctx)
    update(ctx, 0.016)
    // sortRow advanced (sorting happened)
    expect(ctx._sortRow).toBeGreaterThan(0)
  })

  it('sorting modifies pixel data', () => {
    setup(ctx)
    const before = new Uint8Array(ctx._pixelData)
    for (let i = 0; i < 10; i++) update(ctx, 0.02)
    let diffs = 0
    for (let i = 0; i < before.length; i += 4) {
      if (before[i] !== ctx._pixelData[i]) diffs++
    }
    expect(diffs).toBeGreaterThan(0)
  })

  it('teardown() cleans up', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

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

describe('mobius-strip', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./mobius-strip.js'))
  })

  it('setup() creates strip mesh and particles', () => {
    setup(ctx)
    expect(ctx._strip).toBeInstanceOf(Three.Mesh)
    expect(ctx._particles).toBeInstanceOf(Three.Points)
  })

  it('strip uses DoubleSide material', () => {
    setup(ctx)
    expect(ctx._strip.material.side).toBe(Three.DoubleSide)
  })

  it('strip has vertex colors', () => {
    setup(ctx)
    expect(ctx._strip.geometry.attributes.color).toBeDefined()
  })

  it('update() rotates the strip and moves particles', () => {
    setup(ctx)
    const y0 = ctx._strip.rotation.y
    update(ctx, 0.1)
    expect(ctx._strip.rotation.y).toBeGreaterThan(y0)
    // particles were updated (positions changed)
    const pos = ctx._particles.geometry.attributes.position.array
    expect(pos).toBeDefined()
  })

  it('teardown() cleans up', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

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

describe('cloth-sim', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./cloth-sim.js'))
  })

  it('setup() creates cloth mesh and particles', () => {
    setup(ctx)
    expect(ctx._clothMesh).toBeInstanceOf(Three.Mesh)
    expect(ctx._cloth.particles.length).toBe(30 * 24)
  })

  it('cloth has structural constraints', () => {
    setup(ctx)
    expect(ctx._cloth.constraints.length).toBeGreaterThan(0)
  })

  it('some particles are pinned at top row', () => {
    setup(ctx)
    const pinned = ctx._cloth.particles.filter(p => p.pinned)
    expect(pinned.length).toBeGreaterThan(0)
  })

  it('update() moves non-pinned particles via gravity', () => {
    setup(ctx)
    const bottomParticle = ctx._cloth.particles[ctx._cloth.particles.length - 1]
    const y0 = bottomParticle.pos.y
    update(ctx, 0.016)
    // Gravity pulls down
    expect(bottomParticle.pos.y).not.toBe(y0)
  })

  it('pinned particles stay in place', () => {
    setup(ctx)
    const pinned = ctx._cloth.particles.find(p => p.pinned)
    const y0 = pinned.pos.y
    update(ctx, 0.016)
    expect(pinned.pos.y).toBe(y0)
  })

  it('teardown() cleans up', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

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

describe('strange-attractor', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./strange-attractor.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalledWith(1.5)
  })

  it('setup() creates a line and initializes state', () => {
    setup(ctx)
    expect(ctx._line).toBeInstanceOf(Three.Line)
    expect(Array.isArray(ctx._state)).toBe(true)
    expect(ctx._state.length).toBe(3)
    expect(ctx._count).toBe(0)
  })

  it('update() advances point count each frame', () => {
    setup(ctx)
    update(ctx, 0.016)
    expect(ctx._count).toBeGreaterThan(0)
    update(ctx, 0.016)
    expect(ctx._count).toBeGreaterThan(20)
  })

  it('update() runs many frames without throwing', () => {
    setup(ctx)
    for (let i = 0; i < 30; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() removes the line', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._line)
  })
})

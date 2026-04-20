// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx(overrides = {}) {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })

  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new Three.Vector3(0, 0, 50),
    lookAt: vi.fn(), aspect: 1, fov: 60,
    updateProjectionMatrix: vi.fn(),
  }
  return {
    Three, scene, camera,
    renderer: { domElement: canvas, shadowMap: { enabled: false }, setSize: vi.fn() },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('domino-chain', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./domino-chain.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() creates 20 dominoes with physics state', () => {
    setup(ctx)
    expect(Array.isArray(ctx._dominoes)).toBe(true)
    expect(ctx._dominoes.length).toBe(20)
    for (const d of ctx._dominoes) {
      expect(d).toHaveProperty('position')
      expect(d).toHaveProperty('velocity')
      expect(d).toHaveProperty('_mesh')
      expect(d._fallen).toBe(false)
    }
  })

  it('update() runs without throwing before and after topple', () => {
    setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
    // Trigger topple via click
    ctx.renderer.domElement.dispatchEvent(new Event('click'))
    expect(ctx._started).toBe(true)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('teardown() removes event listener and objects', () => {
    setup(ctx)
    const removeSpy = vi.spyOn(ctx.renderer.domElement, 'removeEventListener')
    teardown(ctx)
    expect(removeSpy).toHaveBeenCalledWith('click', ctx._onClick)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

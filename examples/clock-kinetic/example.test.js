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
    add: vi.fn(),
    remove: vi.fn(),
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

describe('clock-kinetic', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./clock-kinetic.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates objects list and three ring groups', () => {
    setup(ctx)
    expect(Array.isArray(ctx._objects)).toBe(true)
    expect(ctx._objects.length).toBeGreaterThan(0)
    expect(ctx._hourRing).toBeDefined()
    expect(ctx._minRing).toBeDefined()
    expect(ctx._secRing).toBeDefined()
  })

  it('update() sets ring rotations from real time without throwing', () => {
    setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
    expect(typeof ctx._hourRing.group.rotation.z).toBe('number')
    expect(typeof ctx._minRing.group.rotation.z).toBe('number')
    expect(typeof ctx._secRing.group.rotation.z).toBe('number')
  })

  it('teardown() removes all objects', () => {
    setup(ctx)
    const objCount = ctx._objects.length
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
    expect(ctx.remove.mock.calls.length).toBe(objCount)
  })
})

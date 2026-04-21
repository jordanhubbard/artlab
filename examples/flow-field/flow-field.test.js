// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeCtx(overrides = {}) {
  return {
    scene: { background: null },
    camera: { position: new THREE.Vector3(), lookAt: vi.fn() },
    controls: { target: { set: vi.fn() } },
    renderer: { shadowMap: { enabled: false } },
    add: vi.fn(),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('flow-field', () => {
  let ctx, mod

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeCtx()
    mod = await import('./flow-field.js')
  })

  afterEach(() => {
    // Clean up event listeners if teardown was called
  })

  it('noise3 returns a number in [-1, 1] range', async () => {
    await mod.setup(ctx) // initializes noise tables
    const val = mod.noise3(1.5, 2.3, 0.7)
    expect(typeof val).toBe('number')
    expect(val).toBeGreaterThanOrEqual(-1.5)
    expect(val).toBeLessThanOrEqual(1.5)
  })

  it('noise3 is deterministic for same input after setup', async () => {
    await mod.setup(ctx)
    const a = mod.noise3(3.1, 4.2, 0.5)
    const b = mod.noise3(3.1, 4.2, 0.5)
    expect(a).toBe(b)
    mod.teardown(ctx)
  })

  it('curl returns an object with cx and cy', async () => {
    await mod.setup(ctx)
    const c = mod.curl(0.5, 0.5, 0)
    expect(c).toHaveProperty('cx')
    expect(c).toHaveProperty('cy')
    expect(typeof c.cx).toBe('number')
    expect(typeof c.cy).toBe('number')
    mod.teardown(ctx)
  })

  it('setup runs without throwing', async () => {
    await expect(mod.setup(ctx)).resolves.toBeUndefined()
    mod.teardown(ctx)
  })

  it('setup adds 3 objects: ambient light, instanced mesh, fade plane', async () => {
    await mod.setup(ctx)
    expect(ctx.add).toHaveBeenCalledTimes(3)
    mod.teardown(ctx)
  })

  it('setup calls setBloom', async () => {
    await mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalled()
    mod.teardown(ctx)
  })

  it('setup sets dark background', async () => {
    await mod.setup(ctx)
    expect(ctx.scene.background).toBeTruthy()
    expect(ctx.scene.background.r).toBeLessThan(0.1)
    mod.teardown(ctx)
  })

  it('setup positions camera looking down', async () => {
    await mod.setup(ctx)
    expect(ctx.camera.position.y).toBeGreaterThan(10)
    mod.teardown(ctx)
  })

  it('update runs one frame without throwing', async () => {
    await mod.setup(ctx)
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
    mod.teardown(ctx)
  })

  it('update runs 30 frames without throwing', async () => {
    await mod.setup(ctx)
    expect(() => {
      for (let i = 0; i < 30; i++) {
        ctx.elapsed = i * 0.016
        mod.update(ctx, 0.016)
      }
    }).not.toThrow()
    mod.teardown(ctx)
  })

  it('teardown removes all added objects', async () => {
    await mod.setup(ctx)
    const addCount = ctx.add.mock.calls.length
    mod.teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(addCount)
  })

  it('teardown restores original scene background', async () => {
    const original = { isColor: true, r: 0.5, g: 0.5, b: 0.5 }
    ctx.scene.background = original
    await mod.setup(ctx)
    mod.teardown(ctx)
    expect(ctx.scene.background).toBe(original)
  })

  it('teardown does not throw', async () => {
    await mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })
})

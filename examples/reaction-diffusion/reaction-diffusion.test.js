// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setup, update, teardown } from './reaction-diffusion.js'

vi.mock('three', async () => await vi.importActual('three'))

// Stub canvas 2D context — jsdom does not implement CanvasRenderingContext2D
const fakeImageData = { data: new Uint8ClampedArray(256 * 256 * 4) }
const fake2DCtx = {
  createImageData: vi.fn(() => fakeImageData),
  putImageData: vi.fn(),
}

HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
  if (type === '2d') return fake2DCtx
  return null
})

function makeCtx(overrides = {}) {
  return {
    scene: { background: null },
    camera: { position: { set: vi.fn() }, lookAt: vi.fn() },
    add: vi.fn(),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('reaction-diffusion', () => {
  let ctx

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = makeCtx()
  })

  it('setup runs without throwing', async () => {
    await expect(setup(ctx)).resolves.toBeUndefined()
  })

  it('setup adds sphere and ambient light, enables bloom', async () => {
    await setup(ctx)
    expect(ctx.add).toHaveBeenCalledTimes(2)
    expect(ctx.setBloom).toHaveBeenCalledWith(1.5)
  })

  it('setup creates a canvas texture via 2D context', async () => {
    await setup(ctx)
    expect(fake2DCtx.createImageData).toHaveBeenCalledWith(256, 256)
  })

  it('update runs without throwing', async () => {
    await setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('update writes pixel data and marks texture dirty', async () => {
    await setup(ctx)
    update(ctx, 0.016)
    expect(fake2DCtx.putImageData).toHaveBeenCalled()
  })

  it('update runs multiple frames without throwing', async () => {
    await setup(ctx)
    expect(() => {
      update(ctx, 0.016)
      ctx.elapsed = 0.016
      update(ctx, 0.016)
      ctx.elapsed = 0.032
      update(ctx, 0.016)
    }).not.toThrow()
  })

  it('teardown removes exactly as many objects as setup added', async () => {
    await setup(ctx)
    const addCount = ctx.add.mock.calls.length
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(addCount)
  })

  it('teardown restores scene background', async () => {
    const original = { isColor: true, r: 0, g: 0, b: 0 }
    ctx.scene.background = original
    await setup(ctx)
    teardown(ctx)
    expect(ctx.scene.background).toBe(original)
  })
})

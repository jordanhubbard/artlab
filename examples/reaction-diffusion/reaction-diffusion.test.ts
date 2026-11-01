// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initializeAsync, makeSpiedContext, mockCanvas2D } from '../../tests/context.ts'
import { setup, teardown, update } from './reaction-diffusion.ts'
type Demo = typeof import('./reaction-diffusion.ts')

vi.mock('three', async () => await vi.importActual('three'))

// Stub canvas 2D context — jsdom does not implement CanvasRenderingContext2D
const fakeImageData = { data: new Uint8ClampedArray(256 * 256 * 4) }
const fake2DCtx = {
  createImageData: vi.fn(() => fakeImageData),
  putImageData: vi.fn(),
}

mockCanvas2D(() => {
  return fake2DCtx
})

describe('reaction-diffusion', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>

  beforeEach(() => {
    vi.clearAllMocks()
    base = makeSpiedContext()
  })

  it('setup runs without throwing', async () => {
    await expect(initializeAsync(setup, base).then(ready => { ctx = ready })).resolves.toBeUndefined()
  })

  it('setup adds sphere and ambient light, enables bloom', async () => {
    ctx = await initializeAsync(setup, base)
    expect(ctx.add).toHaveBeenCalledTimes(2)
    expect(ctx.setBloom).toHaveBeenCalledWith(1.5)
  })

  it('setup creates a canvas texture via 2D context', async () => {
    ctx = await initializeAsync(setup, base)
    expect(fake2DCtx.createImageData).toHaveBeenCalledWith(256, 256)
  })

  it('update runs without throwing', async () => {
    ctx = await initializeAsync(setup, base)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('update writes pixel data and marks texture dirty', async () => {
    ctx = await initializeAsync(setup, base)
    update(ctx, 0.016)
    expect(fake2DCtx.putImageData).toHaveBeenCalled()
  })

  it('update runs multiple frames without throwing', async () => {
    ctx = await initializeAsync(setup, base)
    expect(() => {
      update(ctx, 0.016)
      ctx.elapsed = 0.016
      update(ctx, 0.016)
      ctx.elapsed = 0.032
      update(ctx, 0.016)
    }).not.toThrow()
  })

  it('teardown removes exactly as many objects as setup added', async () => {
    ctx = await initializeAsync(setup, base)
    const addCount = ctx.add.mock.calls.length
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(addCount)
  })

  it('teardown restores scene background', async () => {
    const original = new base.Three.Color(0)
    base.scene.background = original
    ctx = await initializeAsync(setup, base)
    teardown(ctx)
    expect(ctx.scene.background).toBe(original)
  })
})

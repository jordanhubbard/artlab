// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext, mockCanvas2D } from '../../tests/context.ts'
type Demo = typeof import('./canvas-2d.ts')

vi.mock('three', async () => await vi.importActual('three'))

// Stub canvas 2D context before the module is imported
const fake2DCtx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  closePath: vi.fn(),
  clearRect: vi.fn(),
}

// Patch HTMLCanvasElement.prototype.getContext so every canvas.getContext('2d')
// returns our fake — including the one created inside canvas-2d.js
mockCanvas2D(() => fake2DCtx)

describe('canvas-2d', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    mod = await import('./canvas-2d.ts')
  })

  it('setup() does not throw', () => {
    expect(() => (ctx = initialize(mod.setup, base))).not.toThrow()
  })

  it('setup() stores ctx._canvas2d and ctx._ctx2d', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._canvas2d).toBeDefined()
    expect(ctx._canvas2d).toBeInstanceOf(HTMLCanvasElement)
    expect(ctx._ctx2d).toBe(fake2DCtx)
  })

  it('setup() stores ctx._plane as a Three.Mesh', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._plane).toBeInstanceOf(Three.Mesh)
  })

  it('setup() stores ctx._texture as a CanvasTexture', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._texture).toBeInstanceOf(Three.CanvasTexture)
  })

  it('setup() adds the plane via ctx.add', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx.add).toHaveBeenCalledWith(ctx._plane)
  })

  it('update() runs 3 frames without throwing', () => {
    ctx = initialize(mod.setup, base)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('update() calls fake 2D context drawing methods', () => {
    ctx = initialize(mod.setup, base)
    mod.update(ctx, 0.016)
    expect(fake2DCtx.beginPath).toHaveBeenCalled()
    expect(fake2DCtx.arc).toHaveBeenCalled()
    expect(fake2DCtx.stroke).toHaveBeenCalled()
  })

  it('teardown() does not throw', () => {
    ctx = initialize(mod.setup, base)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() calls ctx.remove for plane and point light', () => {
    ctx = initialize(mod.setup, base)
    mod.teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(2)
  })
})

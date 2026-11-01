// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { autoClickButtons, initializeAsync, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./video-fx.ts')

// ── Browser API stubs ────────────────────────────────────────────────────────

const mockStream = {
  getTracks: () => [{ stop: vi.fn() }],
}
vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia:   vi.fn().mockResolvedValue(mockStream),
    getDisplayMedia: vi.fn().mockResolvedValue(mockStream),
  },
})

// MediaRecorder stub
class FakeMediaRecorder {
  state = 'inactive'
  ondataavailable: ((event: BlobEvent) => void) | null = null
  start()  { this.state = 'recording' }
  stop()   { this.state = 'inactive' }
}
vi.stubGlobal('MediaRecorder', FakeMediaRecorder)

// HTMLVideoElement play() stub
Object.defineProperty(window.HTMLVideoElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})

// ── Mock ctx ─────────────────────────────────────────────────────────────────

// ── Tests ────────────────────────────────────────────────────────────────────

describe('video-fx', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    base = makeSpiedContext()

    // Auto-resolve the start-btn click so setup() doesn't hang.
    // Stub querySelector on the container to return a fake button.
    autoClickButtons()

    mod = await import('./video-fx.ts')
  })

  it('setup() completes and adds objects to scene', async () => {
    ctx = await initializeAsync(mod.setup, base)
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalledWith(0.2)
  })

  it('update() runs 3 frames without throwing', async () => {
    ctx = await initializeAsync(mod.setup, base)
    expect(() => { ctx.elapsed = 0;     mod.update(ctx, 0.016) }).not.toThrow()
    expect(() => { ctx.elapsed = 0.016; mod.update(ctx, 0.016) }).not.toThrow()
    expect(() => { ctx.elapsed = 0.032; mod.update(ctx, 0.016) }).not.toThrow()
  })

  it('teardown() runs without throwing', async () => {
    ctx = await initializeAsync(mod.setup, base)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })
})

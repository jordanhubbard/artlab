// @vitest-environment jsdom
import * as Three from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { autoClickButtons, containerOf, initializeAsync, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./video-broadcast.ts')

// Stub getUserMedia — declared once at module scope; stays for all tests
vi.stubGlobal('navigator', {
  mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) }
})
Object.defineProperty(window.HTMLVideoElement.prototype, 'play', {
  configurable: true, value: vi.fn().mockResolvedValue(undefined)
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('video-broadcast', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    base = makeSpiedContext()

    // Auto-resolve the start button so setup() doesn't hang waiting for a click.
    // Inject a fake button directly into the container so _awaitGesture's
    // querySelector('#vb-start-btn') finds it and its click listener fires immediately.
    autoClickButtons()

    mod = await import('./video-broadcast.ts')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('setup() completes and adds the webcam plane to the scene', async () => {
    ctx = await initializeAsync(mod.setup, base)
    expect(ctx.add).toHaveBeenCalled()
    const hasMesh = ctx.scene.children.some(o => o instanceof Three.Mesh)
    expect(hasMesh).toBe(true)
  })

  it('overlay container is appended to the canvas parent', async () => {
    ctx = await initializeAsync(mod.setup, base)
    const container = containerOf(ctx)
    // The overlay is a position:absolute div appended after setup.
    // jsdom normalises inset:'0' → '0px', so we check overflow:hidden as a
    // reliable discriminator (only the broadcast overlay div has it).
    const overlayEl = Array.from(container.children).find(
      el => el instanceof HTMLElement && el.tagName === 'DIV' && el.style.overflow === 'hidden'
    )
    expect(overlayEl).toBeTruthy()
  })

  it('update() runs 3 frames without throwing', async () => {
    ctx = await initializeAsync(mod.setup, base)
    expect(() => { ctx.elapsed = 0;     mod.update(ctx, 0.016) }).not.toThrow()
    expect(() => { ctx.elapsed = 0.016; mod.update(ctx, 0.016) }).not.toThrow()
    expect(() => { ctx.elapsed = 0.032; mod.update(ctx, 0.016) }).not.toThrow()
  })

  it('teardown() removes overlay and does not throw', async () => {
    ctx = await initializeAsync(mod.setup, base)
    const container = containerOf(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
    const overlayEl = Array.from(container.children).find(
      el => el instanceof HTMLElement && el.tagName === 'DIV' && el.style.overflow === 'hidden'
    )
    expect(overlayEl).toBeFalsy()
  })
})

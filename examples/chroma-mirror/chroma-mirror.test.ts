// @vitest-environment jsdom
import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { autoClickButtons, containerOf, initializeAsync, makeSpiedContext, required } from '../../tests/context.ts'
type Demo = typeof import('./chroma-mirror.ts')

// ── Browser API stubs ─────────────────────────────────────────────────────────

const mockTrack  = { stop: vi.fn() }
const mockStream = { getTracks: () => [mockTrack] }

vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue(mockStream),
  },
})

Object.defineProperty(window.HTMLVideoElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})

// Auto-click the gesture button so _awaitGesture() resolves immediately in tests.
autoClickButtons()

// ── Mock ctx ──────────────────────────────────────────────────────────────────

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('chroma-mirror', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    vi.clearAllMocks()
    // Re-apply the resolved value after clearAllMocks resets mock implementations.
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) } })
    base = makeSpiedContext()
    mod = await import('./chroma-mirror.ts')
  })

  afterEach(() => {
    try { mod.teardown(ctx) } catch (_) {}
  })

  it('setup() adds background shapes, lights, and calls setBloom', async () => {
    ctx = await initializeAsync(mod.setup, base)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.5)
    // 2 lights + 18 shapes + 1 video plane = 21
    expect(ctx.add.mock.calls.length).toBe(21)
  })

  it('setup() places a Mesh video plane in the scene', async () => {
    ctx = await initializeAsync(mod.setup, base)
    const meshes = ctx.scene.children.filter(o => o instanceof THREE.Mesh)
    // 18 background shapes + 1 video plane
    expect(meshes.length).toBe(19)
  })

  it('update() rotates background shapes each frame', async () => {
    ctx = await initializeAsync(mod.setup, base)
    const mesh = required(ctx.scene.children.find(o => o instanceof THREE.Mesh))
    const rotBefore = { x: mesh.rotation.x, y: mesh.rotation.y }
    mod.update(ctx, 0.5)
    // spinY for i=0: ((0%5)-2)*0.3 = -0.6, so delta = -0.6 * 0.5 = -0.3
    expect(mesh.rotation.y).toBeCloseTo(rotBefore.y - 0.3, 5)
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('teardown() calls ctx.remove for every object added with ctx.add', async () => {
    ctx = await initializeAsync(mod.setup, base)
    const addCount = ctx.add.mock.calls.length
    mod.teardown(ctx)
    expect(ctx.remove.mock.calls.length).toBe(addCount)
  })

  it('teardown() stops the webcam stream', async () => {
    ctx = await initializeAsync(mod.setup, base)
    // Drain microtasks so the internal getUserMedia.then() handler runs
    // and _stream is populated before teardown checks it.
    await Promise.resolve()
    mod.teardown(ctx)
    expect(mockTrack.stop).toHaveBeenCalled()
  })

  it('setup() shows fallback note and skips video plane when mediaDevices is absent', async () => {
    vi.stubGlobal('navigator', { mediaDevices: undefined })

    const fallbackCtx = makeSpiedContext()
    await mod.setup(fallbackCtx)

    const container = containerOf(fallbackCtx)
    const note = required(container.querySelector('div'))
    expect(note).not.toBeNull()
    expect(note.textContent).toContain('unavailable')

    // No video plane added — only lights and shapes (20 objects)
    expect(fallbackCtx.add.mock.calls.length).toBe(20)

    mod.teardown(fallbackCtx)

    // Restore navigator for subsequent tests
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    })
  })
})

// @vitest-environment jsdom
import * as Three from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { autoClickButtons, initializeAsync, makeSpiedContext, required } from '../../tests/context.ts'
type Demo = typeof import('./video-kaleidoscope.ts')

// ── Browser API stubs ────────────────────────────────────────────────────────

vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
})

Object.defineProperty(window.HTMLVideoElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})

// ── Auto-click: patch HTMLButtonElement so every 'click' listener fires immediately ──

// Intercept addEventListener on button elements — when 'click' is registered
// (with { once: true }), invoke the callback synchronously so the gesture
// Promise resolves before setup() continues.
autoClickButtons()

// ── Mock ctx ─────────────────────────────────────────────────────────────────

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('video-kaleidoscope', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    base = makeSpiedContext()
    // Import fresh module each time (vitest isolates modules per test file,
    // but module-level state persists across tests in the same file without
    // vi.resetModules — we rely on teardown() clearing state instead).
    mod = await import('./video-kaleidoscope.ts')
  })

  afterEach(async () => {
    // Always clean up so module-level state resets between tests
    try { mod.teardown(ctx) } catch (_) {}
  })

  it('setup() completes and adds at least one mesh to scene', async () => {
    ctx = await initializeAsync(mod.setup, base)
    expect(ctx.add).toHaveBeenCalled()
    const meshes = ctx.scene.children.filter(o => o instanceof Three.Mesh)
    expect(meshes.length).toBeGreaterThanOrEqual(1)
  })

  it('update() sets shader time uniform each frame', async () => {
    ctx = await initializeAsync(mod.setup, base)

    ctx.elapsed = 1.5
    mod.update(ctx)

    const mesh = required(ctx.scene.children.find(o => o instanceof Three.Mesh))
    expect(mesh).toBeDefined()
    // time uniform should be ctx.elapsed (minus any rotation offset, which starts at 0)
    expect(mesh.material.uniforms.time.value).toBeCloseTo(1.5)
  })

  it('teardown() does not throw', async () => {
    ctx = await initializeAsync(mod.setup, base)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('K key handler cycles through all segment counts', async () => {
    ctx = await initializeAsync(mod.setup, base)

    const SEGMENTS = mod.__SEGMENTS  // [3, 4, 6, 8, 12]

    const mesh = required(ctx.scene.children.find(o => o instanceof Three.Mesh))
    expect(mesh).toBeDefined()

    // Cycle through every segment once, collecting the uniform value
    const seen = []
    for (let i = 0; i < SEGMENTS.length; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }))
      seen.push(mesh.material.uniforms.segments.value)
    }

    // Every known segment count must have appeared
    for (const s of SEGMENTS) {
      expect(seen).toContain(s)
    }

    // After a full cycle (SEGMENTS.length presses) we've gone 0→1→2→3→4,
    // so one more K press wraps back to index 0 % 5 = 0+1 = 1? No:
    // starting index was 0, after N presses index is N % N = 0, i.e. wraps.
    // One more press → index 1.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }))
    expect(mesh.material.uniforms.segments.value).toBe(SEGMENTS[1])
  })
})

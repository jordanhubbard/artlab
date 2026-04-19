// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'

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
const _origAddEL = HTMLButtonElement.prototype.addEventListener
HTMLButtonElement.prototype.addEventListener = function (type, cb, opts) {
  _origAddEL.call(this, type, cb, opts)
  if (type === 'click') {
    // Fire immediately so _awaitGesture resolves without a real click
    cb(new MouseEvent('click'))
  }
}

// ── Mock ctx ─────────────────────────────────────────────────────────────────

function makeMockCtx() {
  const container = document.createElement('div')
  const canvas    = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  container.appendChild(canvas)

  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }

  return {
    Three,
    scene,
    camera: {
      position: new Three.Vector3(0, 0, 9),
      fov: 60,
      aspect: 16 / 9,
      updateProjectionMatrix: vi.fn(),
      lookAt: vi.fn(),
    },
    renderer: {
      domElement: canvas,
      shadowMap: { enabled: false },
      setSize: vi.fn(),
    },
    controls: {
      update: vi.fn(),
      target: new Three.Vector3(),
      enableDamping: true,
    },
    labelRenderer: {
      render: vi.fn(),
      setSize: vi.fn(),
      domElement: document.createElement('div'),
    },
    add:      vi.fn(obj => { scene.children.push(obj); return obj }),
    remove:   vi.fn(),
    setBloom: vi.fn(),
    elapsed:  0,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('video-kaleidoscope', () => {
  let ctx, mod

  beforeEach(async () => {
    ctx = makeMockCtx()
    // Import fresh module each time (vitest isolates modules per test file,
    // but module-level state persists across tests in the same file without
    // vi.resetModules — we rely on teardown() clearing state instead).
    mod = await import('./video-kaleidoscope.js')
  })

  afterEach(async () => {
    // Always clean up so module-level state resets between tests
    try { mod.teardown(ctx) } catch (_) {}
  })

  it('setup() completes and adds at least one mesh to scene', async () => {
    await mod.setup(ctx)
    expect(ctx.add).toHaveBeenCalled()
    const meshes = ctx.scene.children.filter(o => o instanceof Three.Mesh)
    expect(meshes.length).toBeGreaterThanOrEqual(1)
  })

  it('update() sets shader time uniform each frame', async () => {
    await mod.setup(ctx)

    ctx.elapsed = 1.5
    mod.update(ctx, 0.016)

    const mesh = ctx.scene.children.find(o => o instanceof Three.Mesh)
    expect(mesh).toBeDefined()
    // time uniform should be ctx.elapsed (minus any rotation offset, which starts at 0)
    expect(mesh.material.uniforms.time.value).toBeCloseTo(1.5)
  })

  it('teardown() does not throw', async () => {
    await mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('K key handler cycles through all segment counts', async () => {
    await mod.setup(ctx)

    const SEGMENTS = mod.__SEGMENTS  // [3, 4, 6, 8, 12]

    const mesh = ctx.scene.children.find(o => o instanceof Three.Mesh)
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

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'

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
const _origAddEL = HTMLButtonElement.prototype.addEventListener
HTMLButtonElement.prototype.addEventListener = function (type, cb, opts) {
  _origAddEL.call(this, type, cb, opts)
  if (type === 'click') cb(new MouseEvent('click'))
}

// ── Mock ctx ──────────────────────────────────────────────────────────────────

function makeMockCtx() {
  const container = document.createElement('div')
  const canvas    = document.createElement('canvas')
  container.appendChild(canvas)

  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }

  return {
    THREE,
    scene,
    camera: {
      position: new THREE.Vector3(0, 0, 8),
      fov: 60,
      aspect: 16 / 9,
      updateProjectionMatrix: vi.fn(),
      lookAt: vi.fn(),
    },
    renderer: { domElement: canvas, shadowMap: { enabled: false } },
    controls: { target: new THREE.Vector3() },
    add:      vi.fn(obj => { scene.children.push(obj); return obj }),
    remove:   vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed:  0,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('chroma-mirror', () => {
  let ctx, mod

  beforeEach(async () => {
    vi.clearAllMocks()
    // Re-apply the resolved value after clearAllMocks resets mock implementations.
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream)
    ctx = makeMockCtx()
    mod = await import('./chroma-mirror.js')
  })

  afterEach(() => {
    try { mod.teardown(ctx) } catch (_) {}
  })

  it('setup() adds background shapes, lights, and calls setBloom', async () => {
    await mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.5)
    // 2 lights + 18 shapes + 1 video plane = 21
    expect(ctx.add.mock.calls.length).toBe(21)
  })

  it('setup() places a Mesh video plane in the scene', async () => {
    await mod.setup(ctx)
    const meshes = ctx.scene.children.filter(o => o instanceof THREE.Mesh)
    // 18 background shapes + 1 video plane
    expect(meshes.length).toBe(19)
  })

  it('update() rotates background shapes each frame', async () => {
    await mod.setup(ctx)
    const mesh = ctx.scene.children.find(o => o instanceof THREE.Mesh)
    const rotBefore = { x: mesh.rotation.x, y: mesh.rotation.y }
    mod.update(ctx, 0.5)
    // spinY for i=0: ((0%5)-2)*0.3 = -0.6, so delta = -0.6 * 0.5 = -0.3
    expect(mesh.rotation.y).toBeCloseTo(rotBefore.y - 0.3, 5)
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('teardown() calls ctx.remove for every object added with ctx.add', async () => {
    await mod.setup(ctx)
    const addCount = ctx.add.mock.calls.length
    mod.teardown(ctx)
    expect(ctx.remove.mock.calls.length).toBe(addCount)
  })

  it('teardown() stops the webcam stream', async () => {
    await mod.setup(ctx)
    // Drain microtasks so the internal getUserMedia.then() handler runs
    // and _stream is populated before teardown checks it.
    await Promise.resolve()
    mod.teardown(ctx)
    expect(mockTrack.stop).toHaveBeenCalled()
  })

  it('setup() shows fallback note and skips video plane when mediaDevices is absent', async () => {
    vi.stubGlobal('navigator', { mediaDevices: undefined })

    const fallbackCtx = makeMockCtx()
    await mod.setup(fallbackCtx)

    const container = fallbackCtx.renderer.domElement.parentElement
    const note = container.querySelector('div')
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

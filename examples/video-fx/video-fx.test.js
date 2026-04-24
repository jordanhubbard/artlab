// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

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
  constructor() { this.state = 'inactive'; this.ondataavailable = null }
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

function makeMockCtx() {
  // Canvas must be in a container so parentElement is non-null
  const container = document.createElement('div')
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  container.appendChild(canvas)

  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  return {
    Three,
    scene,
    camera:        { position: new Three.Vector3(0, 0, 11), fov: 60, aspect: 1, updateProjectionMatrix: vi.fn(), projectionMatrix: new Three.Matrix4(), matrixWorldInverse: new Three.Matrix4(), matrixWorld: new Three.Matrix4() },
    renderer:      { domElement: canvas, shadowMap: { enabled: false }, setSize: vi.fn() },
    controls:      { update: vi.fn(), target: new Three.Vector3(), enableDamping: true },
    labelRenderer: { render: vi.fn(), setSize: vi.fn(), domElement: document.createElement('div') },
    add:           vi.fn(obj => { scene.add(obj); return obj }),
    remove:        vi.fn(),
    setBloom:      vi.fn(),
    setHelp:  vi.fn(),
    elapsed:       0,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('video-fx', () => {
  let ctx, mod

  beforeEach(async () => {
    ctx = makeMockCtx()

    // Auto-resolve the start-btn click so setup() doesn't hang.
    // Stub querySelector on the container to return a fake button.
    const container = ctx.renderer.domElement.parentElement
    vi.spyOn(container, 'querySelector').mockReturnValue({
      style:       { display: '' },
      textContent: '',
      addEventListener: (_ev, cb, _opts) => cb(),
      appendChild:  vi.fn(),
      remove:       vi.fn(),
    })

    mod = await import('./video-fx.js')
  })

  it('setup() completes and adds objects to scene', async () => {
    await mod.setup(ctx)
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalledWith(0.2)
  })

  it('update() runs 3 frames without throwing', async () => {
    await mod.setup(ctx)
    expect(() => { ctx.elapsed = 0;     mod.update(ctx, 0.016) }).not.toThrow()
    expect(() => { ctx.elapsed = 0.016; mod.update(ctx, 0.016) }).not.toThrow()
    expect(() => { ctx.elapsed = 0.032; mod.update(ctx, 0.016) }).not.toThrow()
  })

  it('teardown() runs without throwing', async () => {
    await mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })
})

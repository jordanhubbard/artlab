// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'

// Stub getUserMedia — declared once at module scope; stays for all tests
vi.stubGlobal('navigator', {
  mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) }
})
Object.defineProperty(window.HTMLVideoElement.prototype, 'play', {
  configurable: true, value: vi.fn().mockResolvedValue(undefined)
})

function makeMockCtx() {
  const container = document.createElement('div')
  container.getBoundingClientRect = () => ({ left:0, top:0, width:800, height:600 })
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left:0, top:0, width:800, height:600 })
  container.appendChild(canvas)
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  return {
    Three,
    scene,
    camera: { position: new Three.Vector3(0,0,9), fov:60, aspect:1, updateProjectionMatrix: vi.fn(), lookAt: vi.fn() },
    renderer: { domElement: canvas, shadowMap: { enabled: false }, setSize: vi.fn() },
    controls: { update: vi.fn(), target: new Three.Vector3(), enableDamping: true },
    labelRenderer: { render: vi.fn(), setSize: vi.fn(), domElement: document.createElement('div') },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('video-broadcast', () => {
  let ctx, mod

  beforeEach(async () => {
    ctx = makeMockCtx()

    // Auto-resolve the start button so setup() doesn't hang waiting for a click.
    // Inject a fake button directly into the container so _awaitGesture's
    // querySelector('#vb-start-btn') finds it and its click listener fires immediately.
    const fakeBtn = document.createElement('button')
    fakeBtn.id = 'vb-start-btn'
    fakeBtn.style.display = 'block'
    // Override addEventListener so the 'click' callback fires synchronously
    fakeBtn.addEventListener = (_ev, cb, _opts) => { cb() }
    ctx.renderer.domElement.parentElement.appendChild(fakeBtn)

    // Re-assert the getUserMedia mock is still resolving (in case anything touched it)
    navigator.mediaDevices.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] })

    mod = await import('./video-broadcast.js')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('setup() completes and adds the webcam plane to the scene', async () => {
    await mod.setup(ctx)
    expect(ctx.add).toHaveBeenCalled()
    const hasMesh = ctx.scene.children.some(o => o instanceof Three.Mesh)
    expect(hasMesh).toBe(true)
  })

  it('overlay container is appended to the canvas parent', async () => {
    await mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    // The overlay is a position:absolute div appended after setup.
    // jsdom normalises inset:'0' → '0px', so we check overflow:hidden as a
    // reliable discriminator (only the broadcast overlay div has it).
    const overlayEl = Array.from(container.children).find(
      el => el.tagName === 'DIV' && el.style.overflow === 'hidden'
    )
    expect(overlayEl).toBeTruthy()
  })

  it('update() runs 3 frames without throwing', async () => {
    await mod.setup(ctx)
    expect(() => { ctx.elapsed = 0;     mod.update(ctx, 0.016) }).not.toThrow()
    expect(() => { ctx.elapsed = 0.016; mod.update(ctx, 0.016) }).not.toThrow()
    expect(() => { ctx.elapsed = 0.032; mod.update(ctx, 0.016) }).not.toThrow()
  })

  it('teardown() removes overlay and does not throw', async () => {
    await mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    expect(() => mod.teardown(ctx)).not.toThrow()
    const overlayEl = Array.from(container.children).find(
      el => el.tagName === 'DIV' && el.style.overflow === 'hidden'
    )
    expect(overlayEl).toBeFalsy()
  })
})

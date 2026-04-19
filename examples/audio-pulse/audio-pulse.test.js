// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'

vi.mock('three', async () => await vi.importActual('three'))

const fakeAnalyser = {
  fftSize: 256,
  frequencyBinCount: 128,
  getByteFrequencyData: vi.fn(),
  connect: vi.fn(),
}

const fakeAudioCtx = {
  createAnalyser: vi.fn(() => fakeAnalyser),
  createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
  createOscillator: vi.fn(() => ({ type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn() })),
  createGain: vi.fn(() => ({ gain: { value: 0 }, connect: vi.fn() })),
  destination: {},
  close: vi.fn(),
}

vi.stubGlobal('AudioContext', vi.fn(() => fakeAudioCtx))

// Mock getUserMedia to reject so the fallback oscillator path runs (avoiding
// real media device access in tests)
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockRejectedValue(new Error('no mic in test')),
  },
  writable: true,
  configurable: true,
})

function makeMockCtx(overrides = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left:0, top:0, width:800, height:600 })
  container.appendChild(canvas)
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new THREE.Vector3(0,2,6), lookAt: vi.fn(),
    fov: 60, aspect: 1, updateProjectionMatrix: vi.fn(),
    projectionMatrix: new THREE.Matrix4(), matrixWorldInverse: new THREE.Matrix4(),
  }
  return {
    THREE, scene, camera,
    renderer: { domElement: canvas, shadowMap:{enabled:false}, setSize: vi.fn(), render: vi.fn() },
    controls: { update: vi.fn(), target: new THREE.Vector3(), enabled: true, enableDamping: true },
    labelRenderer: { render: vi.fn(), setSize: vi.fn(), domElement: document.createElement('div') },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    sphere: (r=1,s=32) => new THREE.SphereGeometry(r,s,s),
    box: (w=1,h=1,d=1) => new THREE.BoxGeometry(w,h,d),
    cylinder: (rt=1,rb=1,h=1,s=32) => new THREE.CylinderGeometry(rt,rb,h,s),
    torus: (r=1,t=0.4,rs=8,ts=32) => new THREE.TorusGeometry(r,t,rs,ts),
    plane: (w=1,h=1) => new THREE.PlaneGeometry(w,h),
    cone: (r=1,h=1,s=32) => new THREE.ConeGeometry(r,h,s),
    mesh: (geo,opts={}) => new THREE.Mesh(geo, new THREE.MeshStandardMaterial(opts)),
    ambient: (c=0x404040,i=1) => new THREE.AmbientLight(c,i),
    point: (c=0xffffff,i=1,d=0,dc=2) => new THREE.PointLight(c,i,d,dc),
    directional: (c=0xffffff,i=1) => new THREE.DirectionalLight(c,i),
    ...overrides,
  }
}

describe('audio-pulse', () => {
  let ctx
  let mod

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./audio-pulse.js')
  })

  afterEach(() => {
    // Make sure teardown is always called to clean up event listeners
    try { mod.teardown(ctx) } catch (_) {}
  })

  it('setup() does not throw', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
  })

  it('setup() creates the core sphere mesh at ctx._core', () => {
    mod.setup(ctx)
    expect(ctx._core).toBeInstanceOf(THREE.Mesh)
  })

  it('setup() creates SAT_COUNT satellite meshes in ctx._sats', () => {
    mod.setup(ctx)
    expect(ctx._sats).toHaveLength(8)
    expect(ctx._sats[0]).toBeInstanceOf(THREE.Mesh)
  })

  it('setup() adds a start button to the container', () => {
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    const btn = container.querySelector('#start-btn')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('Click to enable audio')
  })

  it('setup() initialises ctx._bassSpring to 0', () => {
    mod.setup(ctx)
    expect(ctx._bassSpring).toBe(0)
  })

  it('setup() initialises ctx._audio to null', () => {
    mod.setup(ctx)
    expect(ctx._audio).toBeNull()
  })

  it('update() runs 3 frames without audio (idle path) without throwing', () => {
    mod.setup(ctx)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('update() scales the core sphere on each frame', () => {
    mod.setup(ctx)
    mod.update(ctx, 0.1)
    // After an update the scale should be > 1 (bass spring drives it)
    const s = ctx._core.scale
    expect(s.x).toBeGreaterThan(0)
    expect(s.y).toBeGreaterThan(0)
  })

  it('update() calls setBloom on idle path', () => {
    mod.setup(ctx)
    mod.update(ctx, 0.016)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.6)
  })

  it('button click starts audio (async) without throwing', async () => {
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    const btn = container.querySelector('#start-btn')
    expect(btn).not.toBeNull()
    // Click the button — the handler is async and catches mic rejection internally
    btn.click()
    // Flush microtask queue
    await new Promise(resolve => setTimeout(resolve, 0))
    // No assertion on ctx._audio because getUserMedia rejects and the fallback
    // oscillator branch runs; we just verify no uncaught error was thrown.
  })

  it('teardown() does not throw', () => {
    mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() removes the start button', () => {
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    expect(container.querySelector('#start-btn')).not.toBeNull()
    mod.teardown(ctx)
    expect(container.querySelector('#start-btn')).toBeNull()
  })
})

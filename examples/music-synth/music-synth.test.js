// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// Tone.Sequence is used directly in _buildSequencers (new Tone.Sequence(...))
// in addition to the sequencer() helper from audio.js, so we need it here too.
vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
  now: vi.fn(() => 0),
  Transport: {
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    state: 'stopped',
    bpm: { value: 120 },
  },
  Synth: vi.fn(() => ({
    connect: vi.fn().mockReturnThis(),
    toDestination: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    triggerAttackRelease: vi.fn(),
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
  })),
  PolySynth: vi.fn(() => ({
    connect: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    triggerAttackRelease: vi.fn(),
    triggerAttack: vi.fn(),
    releaseAll: vi.fn(),
  })),
  NoiseSynth: vi.fn(() => ({
    connect: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    triggerAttackRelease: vi.fn(),
  })),
  // Tone.Sequence is used directly with `new Tone.Sequence(cb, events, sub)`
  Sequence: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
    events: [],
  })),
}))

vi.mock('../../src/stdlib/audio.js', () => ({
  scale:       vi.fn(() => ['A2', 'B2', 'C3']),
  chord:       vi.fn(() => ['A2', 'C3', 'E3']),
  progression: vi.fn(() => [
    ['A2', 'C3', 'E3'],
    ['F2', 'A2', 'C3'],
    ['C2', 'E2', 'G2'],
    ['G2', 'B2', 'D3'],
  ]),
  sequencer:   vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), dispose: vi.fn() })),
  reverb:      vi.fn(() => ({ connect: vi.fn().mockReturnThis(), dispose: vi.fn() })),
  delay:       vi.fn(() => ({ connect: vi.fn().mockReturnThis(), dispose: vi.fn() })),
}))

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

describe('music-synth', () => {
  let ctx
  let mod

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./music-synth.js')
  })

  afterEach(async () => {
    try { await mod.teardown(ctx) } catch (_) {}
  })

  it('setup() does not throw', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
  })

  it('setup() calls ctx.setBloom', () => {
    mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.6)
  })

  it('setup() adds ring meshes and a particle system', () => {
    mod.setup(ctx)
    // 1 ambient + 1 point + 4 rings + 1 particles + 1 beatFlash = 8 minimum
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(8)
  })

  it('setup() adds a "Start Music" button to the container', () => {
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    const btn = container.querySelector('button')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('Start Music')
  })

  it('setup() appends a chord label div to the container', () => {
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    // chord label is position:absolute, pointerEvents:none
    const divs = container.querySelectorAll('div')
    expect(divs.length).toBeGreaterThan(0)
  })

  it('update() runs 3 frames (pre-start) without throwing', () => {
    mod.setup(ctx)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('update() sets chord label text to prompt before start', () => {
    mod.setup(ctx)
    ctx.elapsed = 0.5
    mod.update(ctx, 0.016)
    const container = ctx.renderer.domElement.parentElement
    // Find the chord label (only non-button non-canvas div appended to container)
    const divs = [...container.querySelectorAll('div')]
    const label = divs.find(d => d.textContent.includes('click'))
    expect(label).toBeDefined()
  })

  it('clicking Start Music button resolves Tone.start and builds synths', async () => {
    const Tone = await import('tone')
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    const btn = container.querySelector('button')
    btn.click()
    // flush promises
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(Tone.start).toHaveBeenCalled()
    expect(Tone.Synth).toHaveBeenCalled()
    expect(Tone.PolySynth).toHaveBeenCalled()
    expect(Tone.NoiseSynth).toHaveBeenCalled()
    expect(Tone.Transport.start).toHaveBeenCalled()
  })

  it('teardown() does not throw', async () => {
    mod.setup(ctx)
    await expect(mod.teardown(ctx)).resolves.not.toThrow()
  })

  it('teardown() removes the start button from DOM', async () => {
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    expect(container.querySelector('button')).not.toBeNull()
    await mod.teardown(ctx)
    expect(container.querySelector('button')).toBeNull()
  })

  it('teardown() calls Tone.Transport.stop', async () => {
    const Tone = await import('tone')
    mod.setup(ctx)
    await mod.teardown(ctx)
    expect(Tone.Transport.stop).toHaveBeenCalled()
  })
})

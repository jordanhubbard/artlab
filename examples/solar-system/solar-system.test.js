// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// ── Tone.js mock ──────────────────────────────────────────────────────────────
// Tone.js ESM has unresolvable internal paths in the test environment.
vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
  Transport: { start: vi.fn(), stop: vi.fn(), pause: vi.fn(), state: 'stopped', bpm: { value: 120 } },
  Synth: vi.fn(() => ({ connect: vi.fn().mockReturnThis(), dispose: vi.fn(), triggerAttackRelease: vi.fn() })),
  PolySynth: vi.fn(() => ({ connect: vi.fn().mockReturnThis(), dispose: vi.fn(), triggerAttackRelease: vi.fn() })),
  AMSynth: vi.fn(() => ({ connect: vi.fn().mockReturnThis(), dispose: vi.fn(), triggerAttackRelease: vi.fn() })),
  NoiseSynth: vi.fn(() => ({ connect: vi.fn().mockReturnThis(), dispose: vi.fn(), triggerAttackRelease: vi.fn() })),
  Reverb: vi.fn(() => ({ connect: vi.fn().mockReturnThis(), dispose: vi.fn(), toDestination: vi.fn().mockReturnThis() })),
  FeedbackDelay: vi.fn(() => ({ connect: vi.fn().mockReturnThis(), dispose: vi.fn() })),
  Analyser: vi.fn(() => ({ getValue: vi.fn(() => new Float32Array(32)), dispose: vi.fn() })),
  Sequence: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), dispose: vi.fn() })),
}))

// ── CSS2DRenderer mock ────────────────────────────────────────────────────────
// CSS2DObject must extend Three.Object3D so three.js Group.add() accepts it.

vi.mock('three/addons/renderers/CSS2DRenderer.js', async () => {
  const { Object3D, Vector3 } = await vi.importActual('three')
  class CSS2DObject extends Object3D {
    constructor(element) {
      super()
      this.element = element
      this.isCSS2DObject = true
    }
  }
  class CSS2DRenderer {
    constructor() { this.domElement = document.createElement('div') }
    setSize() {}
    render() {}
  }
  return { CSS2DObject, CSS2DRenderer }
})

// ── Canvas 2D context mock ────────────────────────────────────────────────────
// jsdom doesn't implement canvas.getContext('2d') without the 'canvas' package.
// solar-system uses it inside makeRingTexture() for Saturn's rings.

HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
  if (type === '2d') {
    const gradient = { addColorStop: vi.fn() }
    return {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      createLinearGradient: vi.fn(() => gradient),
      createRadialGradient: vi.fn(() => gradient),
      save: vi.fn(),
      restore: vi.fn(),
    }
  }
  return null
})

// ── Audio mocks ───────────────────────────────────────────────────────────────

const mockAnalyser = {
  fftSize: 256,
  frequencyBinCount: 128,
  getByteFrequencyData: vi.fn((arr) => arr.fill(80)),
  connect: vi.fn(),
}
const mockAudioCtx = {
  createGain: vi.fn(() => ({ gain: { value: 1, setTargetAtTime: vi.fn() }, connect: vi.fn() })),
  createAnalyser: vi.fn(() => mockAnalyser),
  createOscillator: vi.fn(() => ({ type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn() })),
  createDelay: vi.fn(() => ({ delayTime: { value: 0 }, connect: vi.fn() })),
  destination: {},
  currentTime: 0,
  suspend: vi.fn(),
  resume: vi.fn(),
}
vi.stubGlobal('AudioContext', vi.fn(() => mockAudioCtx))
vi.stubGlobal('webkitAudioContext', vi.fn(() => mockAudioCtx))

// ── Mock ctx ──────────────────────────────────────────────────────────────────

function makeMockCtx(overrides = {}) {
  const scene = {
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
  }
  const camera = {
    position: new Three.Vector3(0, 0, 50),
    lookAt: vi.fn(),
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
    fov: 60,
  }
  const controls = {
    update: vi.fn(),
    enableDamping: true,
    enabled: true,
    minDistance: 0,
    maxDistance: Infinity,
    target: new Three.Vector3(),
  }
  // Canvas must be in a container so parentElement is non-null
  // (solar-system uses domElement.parentElement for the start button)
  const container = document.createElement('div')
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)
  const renderer = {
    domElement: canvas,
    setSize: vi.fn(),
    render: vi.fn(),
    shadowMap: { enabled: false },
    toneMapping: 0,
  }

  const ctx = {
    Three,
    scene,
    camera,
    renderer,
    controls,
    labelRenderer: {
      render: vi.fn(),
      setSize: vi.fn(),
      domElement: document.createElement('div'),
    },
    add: vi.fn((obj) => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed: 0,
    ...overrides,
  }
  return ctx
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('solar-system', () => {
  let ctx
  let setup, update, teardown

  beforeEach(async () => {
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./solar-system.js'))
  })

  afterEach(() => {
    ctx.renderer.domElement.parentElement.querySelector('#start-btn')?.remove()
  })

  it('setup() completes without throwing', async () => {
    await expect(setup(ctx)).resolves.toBeUndefined()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() registers planet groups for all 8 planets', async () => {
    await setup(ctx)
    const PLANET_ORDER = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']
    expect(ctx._planets).toBeDefined()
    for (const name of PLANET_ORDER) {
      expect(ctx._planets[name]).toBeDefined()
    }
  })

  it('update() runs 3 frames without throwing', async () => {
    await setup(ctx)
    const frames = [0, 0.016, 0.032]
    for (const elapsed of frames) {
      ctx.elapsed = elapsed
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() runs without throwing', async () => {
    await setup(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

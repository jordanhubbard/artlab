// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { containerOf, initializeAsync, makeSpiedContext, mockCanvas2D } from '../../tests/context.ts'
type Demo = typeof import('./solar-system.ts')

vi.mock('three', async () => await vi.importActual('three'))

// ── Tone.js mock ──────────────────────────────────────────────────────────────
// Tone.js ESM has unresolvable internal paths in the test environment.
vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
  Transport: { start: vi.fn(), stop: vi.fn(), pause: vi.fn(), state: 'stopped', bpm: { value: 120 } },
  Synth: vi.fn(function () { return { connect: vi.fn().mockReturnThis(), dispose: vi.fn(), triggerAttackRelease: vi.fn() } }),
  PolySynth: vi.fn(function () { return { connect: vi.fn().mockReturnThis(), dispose: vi.fn(), triggerAttackRelease: vi.fn() } }),
  AMSynth: vi.fn(function () { return { connect: vi.fn().mockReturnThis(), dispose: vi.fn(), triggerAttackRelease: vi.fn() } }),
  NoiseSynth: vi.fn(function () { return { connect: vi.fn().mockReturnThis(), dispose: vi.fn(), triggerAttackRelease: vi.fn() } }),
  Reverb: vi.fn(function () { return { connect: vi.fn().mockReturnThis(), dispose: vi.fn(), toDestination: vi.fn().mockReturnThis() } }),
  FeedbackDelay: vi.fn(function () { return { connect: vi.fn().mockReturnThis(), dispose: vi.fn() } }),
  Analyser: vi.fn(function () { return { getValue: vi.fn(() => new Float32Array(32)), dispose: vi.fn() } }),
  Sequence: vi.fn(function () { return { start: vi.fn(), stop: vi.fn(), dispose: vi.fn() } }),
}))

// Vite resolves the package's image URLs during tests, which makes jsdom probe
// a 2D canvas while decoding them. A lightweight context keeps that path quiet.
mockCanvas2D(() => ({
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray() })),
}))

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
vi.stubGlobal('AudioContext', vi.fn(function () { return mockAudioCtx }))
vi.stubGlobal('webkitAudioContext', vi.fn(function () { return mockAudioCtx }))

// ── Mock ctx ──────────────────────────────────────────────────────────────────

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('solar-system', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]
  let TEXTURES: Demo["TEXTURES"]

  beforeEach(async () => {
    base = makeSpiedContext()
    ;({ setup, update, teardown, TEXTURES } = await import('./solar-system.ts'))
  })

  afterEach(() => {
    containerOf(ctx).querySelector('#start-btn')?.remove()
  })

  it('setup() completes without throwing', async () => {
    await expect(initializeAsync(setup, base).then(ready => { ctx = ready })).resolves.toBeUndefined()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() registers planet groups for all 8 planets', async () => {
    ctx = await initializeAsync(setup, base)
    const PLANET_ORDER = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']
    expect(ctx._planets).toBeDefined()
    for (const name of PLANET_ORDER) {
      expect(ctx._planets[name]).toBeDefined()
    }
  })

  it('uses the high-resolution texture set where available', () => {
    const expectedTextures = [
      'mercury/8k_mercury.jpg',
      'venus/8k_venus_surface.jpg',
      'venus/4k_venus_atmosphere.jpg',
      'earth/8k_earth_daymap.jpg',
      'earth/8k_earth_nightmap.jpg',
      'earth/8k_earth_clouds.jpg',
      'mars/8k_mars.jpg',
      'jupiter/8k_jupiter.jpg',
      'saturn/8k_saturn.jpg',
      'saturn/8k_saturn_ring_alpha.png',
      'moon/8k_moon.jpg',
    ]
    const textures = Object.values(TEXTURES)
    expect(textures).toEqual(expect.arrayContaining(expectedTextures))
    expect(textures.filter(url => url.includes('/2k_'))).toHaveLength(2)
  })

  it('update() runs 3 frames without throwing', async () => {
    ctx = await initializeAsync(setup, base)
    const frames = [0, 0.016, 0.032]
    for (const elapsed of frames) {
      ctx.elapsed = elapsed
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() runs without throwing', async () => {
    ctx = await initializeAsync(setup, base)
    expect(() => teardown(ctx)).not.toThrow()
  })

  it('teardown() clears the planet labels out of the CSS2D overlay', async () => {
    ctx = await initializeAsync(setup, base)
    const overlay = ctx.labelRenderer.domElement
    // The real CSS2DRenderer parents each label div into its overlay on render,
    // which is where they would otherwise survive a switch to another example.
    for (const { div } of ctx._labelDivs) overlay.appendChild(div)
    expect(overlay.children.length).toBe(8)

    teardown(ctx)

    expect(overlay.children.length).toBe(0)
    expect(ctx._labelDivs).toHaveLength(0)
  })
})

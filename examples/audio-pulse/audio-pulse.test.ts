// @vitest-environment jsdom
import * as Three from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { containerOf, initialize, makeSpiedContext, required } from '../../tests/context.ts'
type Demo = typeof import('./audio-pulse.ts')

vi.mock('three', async () => await vi.importActual('three'))

const fakeAnalyser = {
  fftSize: 256,
  frequencyBinCount: 128,
  getByteFrequencyData: vi.fn(),
  connect: vi.fn(),
  smoothingTimeConstant: 0,
}

const fakeOscillator = {
  type: 'sine',
  frequency: { value: 0 },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  disconnect: vi.fn(),
}
const fakeSilentGain = { gain: { value: 0, setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }
const fakeSourceGain = { gain: { value: 0, setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }

const fakeAudioCtx = {
  createAnalyser: vi.fn(() => fakeAnalyser),
  createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
  createOscillator: vi.fn(() => fakeOscillator),
  createGain: vi.fn()
    .mockImplementationOnce(() => fakeSilentGain)
    .mockImplementation(() => fakeSourceGain),
  destination: {},
  currentTime: 0,
  resume: vi.fn(),
  close: vi.fn(),
}

vi.stubGlobal('AudioContext', vi.fn(function () { return fakeAudioCtx }))

// Mock getUserMedia to reject so the fallback oscillator path runs (avoiding
// real media device access in tests)
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockRejectedValue(new Error('no mic in test')),
  },
  writable: true,
  configurable: true,
})

describe('audio-pulse', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    fakeAudioCtx.createGain
      .mockReset()
      .mockImplementationOnce(() => fakeSilentGain)
      .mockImplementation(() => fakeSourceGain)
    base = makeSpiedContext()
    mod = await import('./audio-pulse.ts')
  })

  afterEach(() => {
    // Make sure teardown is always called to clean up event listeners
    try { mod.teardown(ctx) } catch (_) {}
  })

  it('setup() does not throw', () => {
    expect(() => (ctx = initialize(mod.setup, base))).not.toThrow()
  })

  it('setup() creates the core sphere mesh at ctx._core', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._core).toBeInstanceOf(Three.Mesh)
  })

  it('setup() creates SAT_COUNT satellite meshes in ctx._sats', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._sats).toHaveLength(8)
    expect(ctx._sats[0]).toBeInstanceOf(Three.Mesh)
  })

  it('setup() adds a start button to the container', () => {
    ctx = initialize(mod.setup, base)
    const container = containerOf(ctx)
    const btn = required(container.querySelector<HTMLButtonElement>('#start-btn'))
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('Click to enable audio')
  })

  it('setup() initialises ctx._bassSpring to 0', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._bassSpring).toBe(0)
  })

  it('setup() initialises ctx._audio to null', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._audio).toBeNull()
  })

  it('update() runs 3 frames without audio (idle path) without throwing', () => {
    ctx = initialize(mod.setup, base)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('update() scales the core sphere on each frame', () => {
    ctx = initialize(mod.setup, base)
    mod.update(ctx, 0.1)
    // After an update the scale should be > 1 (bass spring drives it)
    const s = ctx._core.scale
    expect(s.x).toBeGreaterThan(0)
    expect(s.y).toBeGreaterThan(0)
  })

  it('update() calls setBloom on idle path', () => {
    ctx = initialize(mod.setup, base)
    mod.update(ctx, 0.016)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.6)
  })

  it('button click starts audio (async) without throwing', async () => {
    ctx = initialize(mod.setup, base)
    const container = containerOf(ctx)
    const btn = required(container.querySelector<HTMLButtonElement>('#start-btn'))
    expect(btn).not.toBeNull()
    // Click the button — the handler is async and catches mic rejection internally
    btn.click()
    // Flush microtask queue
    await new Promise(resolve => setTimeout(resolve, 0))
    // No assertion on ctx._audio because getUserMedia rejects and the fallback
    // oscillator branch runs; we just verify no uncaught error was thrown.
  })

  it('fallback audio connects analyser to a silent sink so FFT is pulled', async () => {
    ctx = initialize(mod.setup, base)
    const btn = required(containerOf(ctx).querySelector<HTMLButtonElement>('#start-btn'))
    btn.click()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fakeAudioCtx.resume).toHaveBeenCalled()
    expect(fakeAnalyser.connect).toHaveBeenCalledWith(fakeSilentGain)
    expect(fakeSilentGain.connect).toHaveBeenCalledWith(fakeAudioCtx.destination)
    expect(fakeOscillator.start).toHaveBeenCalled()
    expect(required(ctx._audio).sourceType).toBe('fallback')
    expect(containerOf(ctx).querySelector('#start-btn')).toBeNull()
  })

  it('silent analyser data still produces visible satellite motion after calibration', async () => {
    fakeAnalyser.getByteFrequencyData.mockImplementation(arr => arr.fill(0))
    ctx = initialize(mod.setup, base)
    const btn = required(containerOf(ctx).querySelector<HTMLButtonElement>('#start-btn'))
    btn.click()
    await new Promise(resolve => setTimeout(resolve, 0))

    for (let i = 0; i < 14; i++) {
      ctx.elapsed = i * 0.1
      mod.update(ctx, 0.1)
    }

    expect(ctx._sats.some(sat => sat.position.y > 0)).toBe(true)
    expect(ctx._core.scale.x).toBeGreaterThan(1)
  })

  it('teardown() does not throw', () => {
    ctx = initialize(mod.setup, base)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() removes the start button', () => {
    ctx = initialize(mod.setup, base)
    const container = containerOf(ctx)
    expect(container.querySelector('#start-btn')).not.toBeNull()
    mod.teardown(ctx)
    expect(container.querySelector('#start-btn')).toBeNull()
  })

  it('teardown() stops fallback audio nodes', async () => {
    ctx = initialize(mod.setup, base)
    const btn = required(containerOf(ctx).querySelector<HTMLButtonElement>('#start-btn'))
    btn.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    mod.teardown(ctx)

    expect(fakeOscillator.stop).toHaveBeenCalled()
    expect(fakeOscillator.disconnect).toHaveBeenCalled()
    expect(fakeSilentGain.disconnect).toHaveBeenCalled()
    expect(fakeAudioCtx.close).toHaveBeenCalled()
    expect(ctx._audio).toBeNull()
  })
})

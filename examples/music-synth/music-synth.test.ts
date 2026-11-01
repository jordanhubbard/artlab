// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { containerOf, initialize, makeSpiedContext, required } from '../../tests/context.ts'
type Demo = typeof import('./music-synth.ts')

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
    get state() { return 'stopped' },
    bpm: { value: 120 },
  },
  Synth: vi.fn(function () {
    return {
    connect: vi.fn().mockReturnThis(),
    toDestination: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    triggerAttackRelease: vi.fn(),
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    }
  }),
  PolySynth: vi.fn(function () {
    return {
    connect: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    triggerAttackRelease: vi.fn(),
    triggerAttack: vi.fn(),
    releaseAll: vi.fn(),
    }
  }),
  NoiseSynth: vi.fn(function () {
    return {
    connect: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    triggerAttackRelease: vi.fn(),
    }
  }),
  // Tone.Sequence is used directly with `new Tone.Sequence(cb, events, sub)`
  Sequence: vi.fn(function () {
    return {
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
    events: [],
    }
  }),
}))

vi.mock('../../src/stdlib/audio.ts', () => ({
  scale:       vi.fn(() => ['A2', 'B2', 'C3']),
  chord:       vi.fn(() => ['A2', 'C3', 'E3']),
  progression: vi.fn(() => [
    ['A2', 'C3', 'E3'],
    ['F2', 'A2', 'C3'],
    ['C2', 'E2', 'G2'],
    ['G2', 'B2', 'D3'],
  ]),
  sequencer:   vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), dispose: vi.fn() })),
  reverb:      vi.fn(() => ({ connect: vi.fn().mockReturnThis(), toDestination: vi.fn().mockReturnThis(), dispose: vi.fn() })),
  delay:       vi.fn(() => ({ connect: vi.fn().mockReturnThis(), dispose: vi.fn() })),
}))

describe('music-synth', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    base = makeSpiedContext()
    mod = await import('./music-synth.ts')
  })

  afterEach(async () => {
    try { await mod.teardown(ctx) } catch (_) {}
  })

  it('setup() does not throw', () => {
    expect(() => (ctx = initialize(mod.setup, base))).not.toThrow()
  })

  it('setup() calls ctx.setBloom', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.6)
  })

  it('setup() adds ring meshes and a particle system', () => {
    ctx = initialize(mod.setup, base)
    // 1 ambient + 1 point + 4 rings + 1 particles + 1 beatFlash = 8 minimum
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(8)
  })

  it('setup() adds a "Start Music" button to the container', () => {
    ctx = initialize(mod.setup, base)
    const container = containerOf(ctx)
    const btn = required(container.querySelector('button'))
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('Start Music')
  })

  it('setup() appends a chord label div to the container', () => {
    ctx = initialize(mod.setup, base)
    const container = containerOf(ctx)
    // chord label is position:absolute, pointerEvents:none
    const divs = container.querySelectorAll('div')
    expect(divs.length).toBeGreaterThan(0)
  })

  it('update() runs 3 frames (pre-start) without throwing', () => {
    ctx = initialize(mod.setup, base)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('update() sets chord label text to prompt before start', () => {
    ctx = initialize(mod.setup, base)
    ctx.elapsed = 0.5
    mod.update(ctx, 0.016)
    const container = containerOf(ctx)
    // Find the chord label (only non-button non-canvas div appended to container)
    const divs = [...container.querySelectorAll('div')]
    const label = divs.find(d => d.textContent.includes('click'))
    expect(label).toBeDefined()
  })

  it('clicking Start Music button resolves Tone.start and builds synths', async () => {
    const Tone = await import('tone')
    ctx = initialize(mod.setup, base)
    const container = containerOf(ctx)
    const btn = required(container.querySelector('button'))
    btn.click()
    // flush promises
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(Tone.start).toHaveBeenCalled()
    expect(Tone.Synth).toHaveBeenCalled()
    expect(Tone.PolySynth).toHaveBeenCalled()
    expect(Tone.NoiseSynth).toHaveBeenCalled()
    expect(Tone.Transport.start).toHaveBeenCalled()
  })

  it('setHelp names the click that actually starts audio', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx.setHelp).toHaveBeenCalledTimes(1)
    const help = required(ctx.setHelp.mock.calls[0][0]).toLowerCase()
    // Space alone cannot start a suspended AudioContext story: the help must
    // point at the gesture that does.
    expect(help).toMatch(/start music/)
  })

  it('Space starts audio when the sequencer has not been started yet', async () => {
    const Tone = await import('tone')
    ctx = initialize(mod.setup, base)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(Tone.start).toHaveBeenCalled()
    expect(Tone.Transport.start).toHaveBeenCalled()
    expect(Tone.Synth).toHaveBeenCalled()
  })

  it('Space does not build a second set of voices once started', async () => {
    const Tone = await import('tone')
    ctx = initialize(mod.setup, base)

    const container = containerOf(ctx)
    required(container.querySelector('button')).click()
    await new Promise(resolve => setTimeout(resolve, 0))
    const synthCalls = vi.mocked(Tone.Synth).mock.calls.length

    const state = vi.spyOn(Tone.Transport, 'state', 'get').mockReturnValue('started')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(vi.mocked(Tone.Synth).mock.calls.length).toBe(synthCalls)
    expect(Tone.Transport.pause).toHaveBeenCalled()
    state.mockRestore()
  })

  it('starting hides the button so it cannot double-trigger', async () => {
    ctx = initialize(mod.setup, base)
    const container = containerOf(ctx)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(required(container.querySelector('button')).style.display).toBe('none')
  })

  it('teardown() does not throw', async () => {
    ctx = initialize(mod.setup, base)
    await expect(mod.teardown(ctx)).resolves.not.toThrow()
  })

  it('teardown() removes the start button from DOM', async () => {
    ctx = initialize(mod.setup, base)
    const container = containerOf(ctx)
    expect(container.querySelector('button')).not.toBeNull()
    await mod.teardown(ctx)
    expect(container.querySelector('button')).toBeNull()
  })

  it('teardown() calls Tone.Transport.stop', async () => {
    const Tone = await import('tone')
    ctx = initialize(mod.setup, base)
    await mod.teardown(ctx)
    expect(Tone.Transport.stop).toHaveBeenCalled()
  })
})

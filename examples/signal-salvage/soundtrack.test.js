import { describe, expect, it, vi } from 'vitest'

vi.mock('tone', () => ({}))

import { createSoundtrack } from './soundtrack.js'

function node() {
  return {
    connect: vi.fn().mockReturnThis(),
    toDestination: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    triggerAttackRelease: vi.fn(),
    volume: { rampTo: vi.fn() },
    frequency: { rampTo: vi.fn() },
  }
}

function toneMock({ rejectStart = false } = {}) {
  const nodes = []
  const make = vi.fn(function () {
    const result = node()
    nodes.push(result)
    return result
  })
  return {
    nodes,
    start: rejectStart
      ? vi.fn().mockRejectedValue(new Error('audio unavailable'))
      : vi.fn().mockResolvedValue(undefined),
    Limiter: make,
    Reverb: make,
    Filter: make,
    Volume: make,
    PolySynth: make,
    FMSynth: vi.fn(),
    Synth: make,
    MembraneSynth: make,
    NoiseSynth: make,
    Transport: {
      bpm: { value: 0 },
      scheduleRepeat: vi.fn(() => 42),
      clear: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
    },
  }
}

describe('Signal Salvage soundtrack', () => {
  it('starts from a gesture and connects the terminal node to destination', async () => {
    const Tone = toneMock()
    const soundtrack = createSoundtrack({ Tone })

    await soundtrack.start()

    expect(soundtrack.started).toBe(true)
    expect(Tone.start).toHaveBeenCalledTimes(1)
    expect(Tone.nodes[0].toDestination).toHaveBeenCalledTimes(1)
    expect(Tone.Transport.start).toHaveBeenCalledTimes(1)
  })

  it('is idempotent and becomes a silent fallback when Tone cannot start', async () => {
    const Tone = toneMock({ rejectStart: true })
    const soundtrack = createSoundtrack({ Tone })

    await soundtrack.start()
    await soundtrack.start()

    expect(soundtrack.started).toBe(false)
    expect(soundtrack.status).toBe('unavailable')
    expect(Tone.start).toHaveBeenCalledTimes(1)
  })

  it('turns game events into synthesized cues', async () => {
    const Tone = toneMock()
    const soundtrack = createSoundtrack({ Tone })
    await soundtrack.start()

    soundtrack.handle([
      { type: 'collected', combo: 3 },
      { type: 'hit', health: 2 },
      { type: 'pulse', strength: 0.8 },
    ])

    const triggerCount = Tone.nodes.reduce(
      (sum, item) => sum + item.triggerAttackRelease.mock.calls.length,
      0,
    )
    expect(triggerCount).toBe(3)
  })

  it('reacts to game intensity and disposes all resources', async () => {
    const Tone = toneMock()
    const soundtrack = createSoundtrack({ Tone })
    await soundtrack.start()

    soundtrack.update({ combo: 5, wave: 3, health: 1 }, 0.75)
    soundtrack.dispose()
    soundtrack.dispose()

    expect(Tone.Transport.bpm.value).toBe(104)
    expect(Tone.nodes.some(item => item.frequency.rampTo.mock.calls.length > 0)).toBe(true)
    expect(Tone.Transport.clear).toHaveBeenCalledWith(42)
    expect(Tone.Transport.stop).toHaveBeenCalledTimes(1)
    expect(Tone.nodes.every(item => item.dispose.mock.calls.length === 1)).toBe(true)
  })

  it('does not build or start audio after teardown wins a pending start', async () => {
    let resolveStart
    const Tone = toneMock()
    Tone.start = vi.fn(() => new Promise(resolve => { resolveStart = resolve }))
    const soundtrack = createSoundtrack({ Tone })

    const starting = soundtrack.start()
    soundtrack.dispose()
    resolveStart()
    await starting

    expect(soundtrack.started).toBe(false)
    expect(Tone.nodes).toHaveLength(0)
    expect(Tone.Transport.start).not.toHaveBeenCalled()
  })
})

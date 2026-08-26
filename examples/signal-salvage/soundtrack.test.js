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
  let scheduleId = 40
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
    MonoSynth: make,
    FMSynth: vi.fn(),
    Synth: make,
    MembraneSynth: make,
    NoiseSynth: make,
    Transport: {
      bpm: { value: 0 },
      scheduleRepeat: vi.fn(() => ++scheduleId),
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
      { type: 'event-warning', event: 'signal-storm' },
      { type: 'event-started', event: 'signal-storm' },
    ])

    const triggerCount = Tone.nodes.reduce(
      (sum, item) => sum + item.triggerAttackRelease.mock.calls.length,
      0,
    )
    expect(triggerCount).toBe(5)
  })

  it('changes to a non-repeating harmonic scene every four measures', async () => {
    const Tone = toneMock()
    const soundtrack = createSoundtrack({ Tone, random: () => 0 })
    await soundtrack.start()

    const chordSchedule = Tone.Transport.scheduleRepeat.mock.calls
      .find(([, interval]) => interval === '1m')
    expect(chordSchedule).toBeTruthy()

    const initialScene = soundtrack.sceneIndex
    chordSchedule[0](0)
    const initialChord = Tone.nodes
      .flatMap(item => item.triggerAttackRelease.mock.calls)
      .find(([notes]) => Array.isArray(notes))?.[0]
    chordSchedule[0](2)
    chordSchedule[0](4)
    chordSchedule[0](6)
    chordSchedule[0](10)
    expect(soundtrack.sceneIndex).not.toBe(initialScene)
    const padChords = Tone.nodes
      .flatMap(item => item.triggerAttackRelease.mock.calls)
      .filter(([notes]) => Array.isArray(notes))
    expect(padChords.at(-1)[0]).not.toEqual(initialChord)

    const previousScene = soundtrack.sceneIndex
    chordSchedule[0](12)
    chordSchedule[0](14)
    chordSchedule[0](16)
    chordSchedule[0](20)
    expect(soundtrack.sceneIndex).not.toBe(previousScene)
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
    expect(Tone.Transport.clear).toHaveBeenCalledTimes(1)
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

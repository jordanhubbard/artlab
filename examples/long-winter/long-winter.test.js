// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Three from 'three'

vi.mock('tone', () => ({
  Transport: { clear: vi.fn(), stop: vi.fn() },
}))

import { DURATION, PARTS, musicalPosition } from './score.js'
import { TrackerTransport } from './TrackerTransport.js'

function mockCtx() {
  const container = document.createElement('div')
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)
  document.body.appendChild(container)
  const camera = new Three.PerspectiveCamera(60, 1, 0.1, 100)
  return {
    Three,
    camera,
    renderer: { domElement: canvas, info: { render: { calls: 5 } } },
    controls: { enabled: true, target: new Three.Vector3(), update: vi.fn() },
    add: vi.fn(object => object),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp: vi.fn(),
    elapsed: 0,
  }
}

function fakeTone() {
  const node = () => ({ connect: vi.fn().mockReturnThis(), toDestination: vi.fn().mockReturnThis(), dispose: vi.fn() })
  const synth = () => ({ ...node(), triggerAttackRelease: vi.fn() })
  const Transport = {
    bpm: { value: 0 }, seconds: 0, start: vi.fn(), stop: vi.fn(), pause: vi.fn(),
    scheduleRepeat: vi.fn(() => 19), clear: vi.fn(),
  }
  return {
    start: vi.fn().mockResolvedValue(undefined), Transport,
    Limiter: vi.fn(function Limiter() { return node() }),
    Reverb: vi.fn(function Reverb() { return node() }),
    Volume: vi.fn(function Volume() { return node() }),
    Synth: vi.fn(function Synth() { return synth() }),
    PolySynth: vi.fn(function PolySynth() { return synth() }),
    MonoSynth: vi.fn(function MonoSynth() { return synth() }),
    MembraneSynth: vi.fn(function MembraneSynth() { return synth() }),
    NoiseSynth: vi.fn(function NoiseSynth() { return synth() }),
  }
}

describe('Long Winter score', () => {
  it('covers a roughly two-minute performance with six contiguous passages', () => {
    expect(DURATION).toBeGreaterThan(100)
    expect(DURATION).toBeLessThan(125)
    expect(PARTS).toHaveLength(6)
    expect(PARTS[0].startBar).toBe(0)
    for (let i = 1; i < PARTS.length; i++) expect(PARTS[i].startBar).toBe(PARTS[i - 1].endBar)
  })

  it('maps absolute song time to deterministic pattern, row, and part positions', () => {
    const opening = musicalPosition(0)
    const middle = musicalPosition(DURATION / 2)
    const ending = musicalPosition(DURATION)
    expect(opening).toMatchObject({ pattern: 0, row: 0, partIndex: 0 })
    expect(middle.part.id).toBe('reveal')
    expect(ending.part.id).toBe('return')
    expect(ending.seconds).toBe(DURATION)
  })
})

describe('TrackerTransport', () => {
  it('uses transport time, supports seek/pause, and releases the scheduled score', async () => {
    const Tone = fakeTone()
    const transport = new TrackerTransport({ Tone, now: () => 10 })
    await transport.start()
    expect(transport.status).toBe('playing')
    expect(Tone.Transport.bpm.value).toBe(112)
    Tone.Transport.seconds = 12.5
    expect(transport.position.seconds).toBe(12.5)
    transport.togglePause()
    expect(Tone.Transport.pause).toHaveBeenCalled()
    transport.seek(22)
    expect(Tone.Transport.seconds).toBe(22)
    transport.dispose()
    expect(Tone.Transport.clear).toHaveBeenCalledWith(19)
  })

  it('keeps the visuals running on a silent clock when audio cannot start', async () => {
    const Tone = fakeTone()
    Tone.start.mockRejectedValueOnce(new Error('no device'))
    let now = 4
    const transport = new TrackerTransport({ Tone, now: () => now })
    await transport.start()
    now = 9
    expect(transport.status).toBe('silent')
    expect(transport.seconds).toBe(5)
  })

  it('uses one noise hit when a tracker row contains both snare and hi-hat', async () => {
    const Tone = fakeTone()
    const transport = new TrackerTransport({ Tone })
    await transport.start()
    Tone.Transport.seconds = 65 * 60 / 112
    transport.playStep(1)
    expect(transport.noise.triggerAttackRelease).toHaveBeenCalledTimes(1)
    transport.dispose()
  })
})

describe('Long Winter example', () => {
  let ctx
  let example

  beforeEach(async () => {
    document.body.innerHTML = ''
    ctx = mockCtx()
    example = await import('./long-winter.js')
  })

  afterEach(async () => { await example.teardown(ctx) })

  it('builds a one-gesture show with source exploration and a fixed instance workload', () => {
    example.setup(ctx)
    expect(ctx.setHelp).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(4)
    expect(document.querySelector('.lw-watch')?.textContent).toBe('WATCH')
    expect(document.querySelector('.lw-score')).not.toBeNull()
    expect(document.querySelector('.lw-source')).not.toBeNull()
    expect(() => example.update(ctx, 1 / 60)).not.toThrow()
  })

  it('removes objects and UI and restores camera controls on teardown', async () => {
    example.setup(ctx)
    expect(ctx.controls.enabled).toBe(false)
    await example.teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
    expect(ctx.controls.enabled).toBe(true)
    expect(document.querySelector('[data-long-winter]')).toBeNull()
  })
})

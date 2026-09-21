// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Three from 'three'

vi.mock('tone', () => ({
  Transport: { clear: vi.fn(), stop: vi.fn() },
}))

import { ACTS, DURATION, musicalPosition, stepAt } from './score.js'
import { DemoGraphics } from './DemoGraphics.js'
import { NordicLandscape } from './NordicLandscape.js'
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
    FMSynth: vi.fn(function FMSynth() { return synth() }),
    PolySynth: vi.fn(function PolySynth() { return synth() }),
    MonoSynth: vi.fn(function MonoSynth() { return synth() }),
    MembraneSynth: vi.fn(function MembraneSynth() { return synth() }),
    NoiseSynth: vi.fn(function NoiseSynth() { return synth() }),
  }
}

describe('Long Winter score', () => {
  it('covers a roughly two-minute performance with nine contiguous acts and songs', () => {
    expect(DURATION).toBeGreaterThan(100)
    expect(DURATION).toBeLessThan(125)
    expect(ACTS).toHaveLength(9)
    expect(ACTS[0].startBar).toBe(0)
    expect(new Set(ACTS.map(act => act.song.title)).size).toBe(9)
    for (let i = 1; i < ACTS.length; i++) expect(ACTS[i].startBar).toBe(ACTS[i - 1].endBar)
  })

  it('maps absolute song time to deterministic pattern, row, and part positions', () => {
    const opening = musicalPosition(0)
    const middle = musicalPosition(DURATION / 2)
    const ending = musicalPosition(DURATION)
    expect(opening).toMatchObject({ pattern: 0, row: 0, partIndex: 0 })
    expect(middle.act.id).toBe('birch-run')
    expect(ending.act.id).toBe('first-light')
    expect(ending.seconds).toBe(DURATION)
  })

  it('gives neighboring acts different melodic and rhythmic tracker rows', () => {
    const first = stepAt(musicalPosition(0))
    const second = stepAt(musicalPosition(ACTS[1].startBar * 4 * 60 / 110))
    expect(first.melodyNote).not.toBe(second.melodyNote)
    expect(ACTS[0].song.kick).not.toEqual(ACTS[1].song.kick)
  })
})

describe('Northern Light rendering', () => {
  it('builds nonplanar terrain with finite normals and releases the reflection target', () => {
    const landscape = new NordicLandscape()
    expect(landscape.cabin).toBeInstanceOf(Three.Group)
    expect(landscape.mountains).toHaveLength(3)
    const geometry = landscape.mountains[0].geometry
    expect(new Set(Array.from(geometry.attributes.position.array).filter((_, i) => i % 3 === 1)).size).toBeGreaterThan(1000)
    expect(Array.from(geometry.attributes.normal.array).every(Number.isFinite)).toBe(true)
    expect(landscape.trees.children.every(tree => tree.isInstancedMesh)).toBe(true)
    const dispose = vi.spyOn(landscape.lake.getRenderTarget(), 'dispose')
    landscape.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('traces at drawing-buffer resolution and restores the same scene when seeking', () => {
    const demo = new DemoGraphics()
    const activity = { bass: .2, melody: .4, drums: .6 }
    const time = ACTS[7].startBar * 4 * 60 / 110
    demo.update(1 / 60, musicalPosition(time), activity)
    expect(demo.object.visible).toBe(true)
    expect(demo.uniforms.uMode.value).toBe(2)
    expect(demo.uniforms.uResolution.value.toArray()).toEqual([1280, 720])
    demo.update(1 / 60, musicalPosition(0), activity)
    expect(demo.object.visible).toBe(false)
    demo.update(1 / 60, musicalPosition(time), activity)
    expect(demo.uniforms.uTime.value).toBe(time)
    expect(demo.uniforms.uEnergy.value.toArray()).toEqual([.2, .4, .6])
    demo.dispose()
  })
})

describe('TrackerTransport', () => {
  it('uses transport time, supports seek/pause, and releases the scheduled score', async () => {
    const Tone = fakeTone()
    const transport = new TrackerTransport({ Tone, now: () => 10 })
    await transport.start()
    expect(transport.status).toBe('playing')
    expect(Tone.Transport.bpm.value).toBe(110)
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
    Tone.Transport.seconds = 73 * 60 / 110
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
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(document.querySelector('.lw-watch')?.textContent).toBe('WATCH NORTHERN LIGHT')
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

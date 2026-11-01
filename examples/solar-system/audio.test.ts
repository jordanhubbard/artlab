import { describe, expect, it, vi } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { setupAudio, updateAudio, teardownAudio } from './audio.ts'
import type { SolarAudioContext } from './audio.ts'

vi.mock('tone', () => {
  class Node {
    volume = { rampTo: vi.fn() }
    connect = vi.fn().mockReturnThis()
    toDestination = vi.fn().mockReturnThis()
    generate = vi.fn().mockResolvedValue(undefined)
    triggerAttack = vi.fn()
    triggerRelease = vi.fn()
    releaseAll = vi.fn()
    dispose = vi.fn()
    getValue = () => new Float32Array(128).fill(-60)
  }
  return {
    start: vi.fn().mockResolvedValue(undefined), now: () => 123,
    Reverb: Node, FeedbackDelay: Node, Volume: Node,
    PolySynth: Node, AMSynth: Node, Synth: Node, Analyser: Node,
    Transport: { stop: vi.fn() }, context: { close: vi.fn() },
  }
})

describe('Solar System proximity pads', () => {
  it('releases the planet note on departure and every active voice on teardown', async () => {
    const camera = new PerspectiveCamera()
    const ctx: SolarAudioContext = {
      camera, setBloom: vi.fn(), _planets: { earth: { position: new Vector3() } },
    }
    await setupAudio(ctx)
    const audio = ctx._audio
    if (!audio) throw new Error('Audio setup did not create a graph')
    const earthPad = audio.pads.earth

    updateAudio(ctx, 1 / 60)
    expect(earthPad.triggerAttack).toHaveBeenCalledWith('A3', 123)
    camera.position.set(300, 0, 0)
    updateAudio(ctx, 1 / 60)
    expect(earthPad.triggerRelease).toHaveBeenCalledWith('A3', 123)

    camera.position.set(0, 0, 0)
    updateAudio(ctx, 1 / 60)
    teardownAudio(ctx)
    expect(earthPad.releaseAll).toHaveBeenCalledWith(123)
    expect(earthPad.dispose).toHaveBeenCalledOnce()
    expect(ctx._audio).toBeNull()
  })
})

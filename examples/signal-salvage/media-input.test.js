// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createMediaInput } from './media-input.js'

function stream(kind) {
  const track = { kind, stop: vi.fn() }
  return { getTracks: () => [track], track }
}

function audioContext() {
  const analyser = {
    fftSize: 0,
    connect: vi.fn(),
    getFloatTimeDomainData: vi.fn(buffer => buffer.fill(0.5)),
    disconnect: vi.fn(),
  }
  const source = { connect: vi.fn(), disconnect: vi.fn() }
  const silentGain = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { setValueAtTime: vi.fn() },
  }
  return {
    analyser,
    source,
    silentGain,
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createAnalyser: vi.fn(() => analyser),
    createMediaStreamSource: vi.fn(() => source),
    createGain: vi.fn(() => silentGain),
    close: vi.fn().mockResolvedValue(undefined),
  }
}

const documentRef = {
  createElement: tag => tag === 'canvas'
    ? { getContext: () => null }
    : { srcObject: null, play: vi.fn().mockResolvedValue(undefined) },
}

describe('Signal Salvage media input', () => {
  it('starts camera and microphone independently', async () => {
    const camera = stream('video')
    const microphone = stream('audio')
    const mediaDevices = {
      getUserMedia: vi.fn()
        .mockResolvedValueOnce(camera)
        .mockResolvedValueOnce(microphone),
    }
    const rawAudio = audioContext()
    const input = createMediaInput({
      mediaDevices,
      createAudioContext: () => rawAudio,
      documentRef,
    })

    await input.start()

    expect(input.cameraStatus).toBe('active')
    expect(input.microphoneStatus).toBe('active')
    expect(input.video.srcObject).toBe(camera)
    expect(input.video.play).toHaveBeenCalledTimes(1)
    expect(rawAudio.source.connect).toHaveBeenCalledWith(rawAudio.analyser)
    expect(rawAudio.resume).toHaveBeenCalledTimes(1)
    expect(rawAudio.analyser.connect).toHaveBeenCalledWith(rawAudio.silentGain)
    expect(rawAudio.silentGain.connect).toHaveBeenCalledWith(rawAudio.destination)
  })

  it('falls back without rejecting when permissions are denied', async () => {
    const mediaDevices = {
      getUserMedia: vi.fn()
        .mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
        .mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError')),
    }
    const input = createMediaInput({
      mediaDevices,
      createAudioContext: () => audioContext(),
      documentRef,
    })

    await expect(input.start()).resolves.toBeUndefined()

    expect(input.cameraStatus).toBe('denied')
    expect(input.microphoneStatus).toBe('denied')
    expect(input.texture).toBeTruthy()
  })

  it('reports normalized microphone energy', async () => {
    const camera = stream('video')
    const microphone = stream('audio')
    const rawAudio = audioContext()
    const input = createMediaInput({
      mediaDevices: {
        getUserMedia: vi.fn()
          .mockResolvedValueOnce(camera)
          .mockResolvedValueOnce(microphone),
      },
      createAudioContext: () => rawAudio,
      documentRef,
    })
    await input.start()

    input.update(1)

    expect(input.micEnergy).toBeCloseTo(0.5)
    expect(input.motion.x).toBeGreaterThanOrEqual(-1)
    expect(input.motion.x).toBeLessThanOrEqual(1)
  })

  it('stops tracks, disconnects nodes, and closes audio exactly once', async () => {
    const camera = stream('video')
    const microphone = stream('audio')
    const rawAudio = audioContext()
    const input = createMediaInput({
      mediaDevices: {
        getUserMedia: vi.fn()
          .mockResolvedValueOnce(camera)
          .mockResolvedValueOnce(microphone),
      },
      createAudioContext: () => rawAudio,
      documentRef,
    })
    await input.start()

    await input.dispose()
    await input.dispose()

    expect(camera.track.stop).toHaveBeenCalledTimes(1)
    expect(microphone.track.stop).toHaveBeenCalledTimes(1)
    expect(rawAudio.source.disconnect).toHaveBeenCalledTimes(1)
    expect(rawAudio.analyser.disconnect).toHaveBeenCalledTimes(1)
    expect(rawAudio.silentGain.disconnect).toHaveBeenCalledTimes(1)
    expect(rawAudio.close).toHaveBeenCalledTimes(1)
    expect(input.video.srcObject).toBeNull()
  })

  it('stops streams that resolve after teardown instead of resurrecting media', async () => {
    let resolveCamera
    let resolveMicrophone
    const camera = stream('video')
    const microphone = stream('audio')
    const rawAudio = audioContext()
    const input = createMediaInput({
      mediaDevices: {
        getUserMedia: vi.fn()
          .mockImplementationOnce(() => new Promise(resolve => { resolveCamera = resolve }))
          .mockImplementationOnce(() => new Promise(resolve => { resolveMicrophone = resolve })),
      },
      createAudioContext: () => rawAudio,
      documentRef,
    })

    const starting = input.start()
    await input.dispose()
    resolveCamera(camera)
    resolveMicrophone(microphone)
    await starting

    expect(camera.track.stop).toHaveBeenCalledTimes(1)
    expect(microphone.track.stop).toHaveBeenCalledTimes(1)
    expect(input.video.srcObject).toBeNull()
    expect(input.cameraStatus).not.toBe('active')
    expect(input.microphoneStatus).not.toBe('active')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { MicrophoneInput } from '../media.ts'

function audio() {
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() })
  const context = {
    state: 'running', currentTime: 0, destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(async () => { context.state = 'closed' }),
    createMediaStreamSource: vi.fn(node),
    createAnalyser: vi.fn(() => ({ ...node(), frequencyBinCount: 4, getByteFrequencyData: (data: Uint8Array) => data.set([0, 64, 128, 255]) })),
    createGain: vi.fn(() => ({ ...node(), gain: { value: 1 } })),
  }
  return context
}

function audioConstructor(create: () => ReturnType<typeof audio>): typeof AudioContext {
  // Native Web Audio objects are replaced only at this test dependency boundary.
  return class { constructor() { return create() } } as unknown as typeof AudioContext
}

it('reads normalized bands without routing audible microphone output', async () => {
  const context = audio(), stop = vi.fn()
  const microphone = new MicrophoneInput({
    AudioContext: audioConstructor(() => context),
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
  })
  await microphone.start()
  microphone.update()
  expect(microphone.level(0.5, 1)).toBeCloseTo((128 + 255) / 510)
  expect(microphone.silent?.gain.value).toBe(0)
  expect(microphone.source?.connect).toHaveBeenCalledWith(microphone.analyser)
  await microphone.dispose()
  await microphone.dispose()
  expect(stop).toHaveBeenCalledTimes(1)
  expect(context.close).toHaveBeenCalledTimes(1)
})

it('stops a permission result that arrives after its scene was disposed', async () => {
  const context = audio(), stop = vi.fn()
  let resolve: ((stream: MediaStream) => void) | undefined
  const microphone = new MicrophoneInput({
    AudioContext: audioConstructor(() => context),
    mediaDevices: { getUserMedia: () => new Promise<MediaStream>(done => { resolve = done }) },
  })
  const pending = microphone.start()
  await microphone.dispose()
  if (!resolve) throw new Error('Microphone permission request did not start')
  resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream)
  await pending
  expect(stop).toHaveBeenCalledTimes(1)
  expect(context.createMediaStreamSource).not.toHaveBeenCalled()
  expect(microphone.active).toBe(false)
})

it('closes a failed startup and permits retry from another gesture', async () => {
  const contexts: ReturnType<typeof audio>[] = [], stop = vi.fn()
  const microphone = new MicrophoneInput({
    AudioContext: audioConstructor(() => { const context = audio(); contexts.push(context); return context }),
    mediaDevices: { getUserMedia: vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce({ getTracks: () => [{ stop }] }) },
  })
  await expect(microphone.start()).rejects.toThrow('denied')
  expect(contexts[0].state).toBe('closed')
  await microphone.start()
  expect(microphone.active).toBe(true)
  await microphone.dispose()
  expect(contexts[1].state).toBe('closed')
})

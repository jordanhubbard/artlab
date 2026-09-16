import { describe, it, expect, vi } from 'vitest'
import { MicrophoneInput } from '../media.js'

function audio() {
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() })
  const context = {
    state: 'running', currentTime: 0, destination: {},
    resume: vi.fn().mockResolvedValue(),
    close: vi.fn(async () => { context.state = 'closed' }),
    createMediaStreamSource: vi.fn(node),
    createAnalyser: vi.fn(() => ({ ...node(), frequencyBinCount: 4, getByteFrequencyData: data => data.set([0, 64, 128, 255]) })),
    createGain: vi.fn(() => ({ ...node(), gain: { value: 1 } })),
  }
  return context
}

it('reads normalized bands without routing audible microphone output', async () => {
  const context = audio(), stop = vi.fn()
  const microphone = new MicrophoneInput({
    AudioContext: class { constructor() { return context } },
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
  })
  await microphone.start()
  microphone.update()
  expect(microphone.level(0.5, 1)).toBeCloseTo((128 + 255) / 510)
  expect(microphone.silent.gain.value).toBe(0)
  expect(microphone.source.connect).toHaveBeenCalledWith(microphone.analyser)
  await microphone.dispose()
  await microphone.dispose()
  expect(stop).toHaveBeenCalledTimes(1)
  expect(context.close).toHaveBeenCalledTimes(1)
})

it('stops a permission result that arrives after its scene was disposed', async () => {
  const context = audio(), stop = vi.fn()
  let resolve
  const microphone = new MicrophoneInput({
    AudioContext: class { constructor() { return context } },
    mediaDevices: { getUserMedia: () => new Promise(done => { resolve = done }) },
  })
  const pending = microphone.start()
  await microphone.dispose()
  resolve({ getTracks: () => [{ stop }] })
  await pending
  expect(stop).toHaveBeenCalledTimes(1)
  expect(context.createMediaStreamSource).not.toHaveBeenCalled()
  expect(microphone.active).toBe(false)
})

it('closes a failed startup and permits retry from another gesture', async () => {
  const contexts = [], stop = vi.fn()
  const microphone = new MicrophoneInput({
    AudioContext: class { constructor() { const context = audio(); contexts.push(context); return context } },
    mediaDevices: { getUserMedia: vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce({ getTracks: () => [{ stop }] }) },
  })
  await expect(microphone.start()).rejects.toThrow('denied')
  expect(contexts[0].state).toBe('closed')
  await microphone.start()
  expect(microphone.active).toBe(true)
  await microphone.dispose()
  expect(contexts[1].state).toBe('closed')
})

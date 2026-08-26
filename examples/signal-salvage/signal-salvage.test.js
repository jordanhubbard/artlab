// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Three from 'three'

const media = {
  start: vi.fn().mockResolvedValue(undefined),
  update: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined),
  cameraStatus: 'denied',
  microphoneStatus: 'denied',
  motion: { x: 0, y: 0, amount: 0 },
  micEnergy: 0,
  texture: new Three.Texture(),
}
const soundtrack = {
  start: vi.fn().mockResolvedValue(undefined),
  update: vi.fn(),
  handle: vi.fn(),
  dispose: vi.fn(),
  status: 'active',
}
const view = {
  sync: vi.fn(),
  setTexture: vi.fn(),
  dispose: vi.fn(),
}

vi.mock('tone', () => ({}))
vi.mock('./media-input.js', () => ({ createMediaInput: vi.fn(() => media) }))
vi.mock('./soundtrack.js', () => ({ createSoundtrack: vi.fn(() => soundtrack) }))
vi.mock('./scene.js', () => ({ createSignalScene: vi.fn(() => view) }))

function makeCtx() {
  const container = document.createElement('div')
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)
  document.body.appendChild(container)
  return {
    renderer: { domElement: canvas },
    camera: new Three.PerspectiveCamera(),
    controls: { enabled: true, target: new Three.Vector3() },
    setHelp: vi.fn(),
    setBloom: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    elapsed: 0,
    container,
  }
}

describe('Signal Salvage lifecycle', () => {
  let mod
  let ctx

  beforeEach(async () => {
    vi.clearAllMocks()
    media.motion = { x: 0, y: 0, amount: 0 }
    media.micEnergy = 0
    document.body.innerHTML = ''
    ctx = makeCtx()
    mod = await import('./signal-salvage.js')
  })

  afterEach(async () => {
    await mod.teardown(ctx)
  })

  it('shows privacy onboarding and waits for a gesture before media or audio', () => {
    mod.setup(ctx)

    expect(ctx.setHelp).toHaveBeenCalledWith(expect.stringMatching(/WASD.*Space.*P.*R/))
    expect(ctx.container.textContent).toMatch(/processed locally/i)
    expect(ctx.container.textContent).toMatch(/Camera.*signal veil.*motion ripples/i)
    expect(ctx.container.textContent).toMatch(/Microphone.*pulse charge.*world intensity/i)
    expect(media.start).not.toHaveBeenCalled()
    expect(soundtrack.start).not.toHaveBeenCalled()
  })

  it('starts media, audio, and keyboard-only gameplay from the button', async () => {
    mod.setup(ctx)

    ctx.container.querySelector('button').click()
    await new Promise(resolve => setTimeout(resolve, 0))
    mod.update(ctx, 0.016)

    expect(media.start).toHaveBeenCalledTimes(1)
    expect(soundtrack.start).toHaveBeenCalledTimes(1)
    expect(view.setTexture).toHaveBeenCalledWith(media.texture)
    expect(view.sync).toHaveBeenCalled()
    expect(ctx.container.textContent).toMatch(/CAMERA\s+DENIED/i)
  })

  it('keeps camera motion out of steering and routes it to scene effects', async () => {
    media.motion = { x: 1, y: -0.5, amount: 0.8 }
    media.micEnergy = 0.65
    mod.setup(ctx)
    ctx.container.querySelector('button').click()
    await new Promise(resolve => setTimeout(resolve, 0))

    mod.update(ctx, 0.5)

    const [state, , , signals] = view.sync.mock.calls.at(-1)
    expect(state.player.x).toBe(0)
    expect(state.player.y).toBe(0)
    expect(signals).toEqual({
      motion: media.motion,
      micEnergy: media.micEnergy,
    })
    expect(ctx.container.textContent).toMatch(/CAM MOTION\s+████████░░/)
    expect(ctx.container.textContent).toMatch(/MIC ENERGY\s+███████░░░/)
  })

  it('supports pause and restart controls', async () => {
    mod.setup(ctx)
    ctx.container.querySelector('button').click()
    await new Promise(resolve => setTimeout(resolve, 0))

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }))
    mod.update(ctx, 1)
    expect(ctx.container.textContent).toMatch(/PAUSED/i)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }))
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('removes UI, listeners, media, audio, and scene resources on teardown', async () => {
    mod.setup(ctx)
    const eventSpy = vi.spyOn(window, 'removeEventListener')

    await mod.teardown(ctx)
    await mod.teardown(ctx)

    expect(ctx.container.querySelector('[data-signal-salvage]')).toBeNull()
    expect(media.dispose).toHaveBeenCalledTimes(1)
    expect(soundtrack.dispose).toHaveBeenCalledTimes(1)
    expect(view.dispose).toHaveBeenCalledTimes(1)
    expect(eventSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(eventSpy).toHaveBeenCalledWith('keyup', expect.any(Function))
  })
})

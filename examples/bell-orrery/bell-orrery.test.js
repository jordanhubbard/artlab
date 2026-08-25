// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'

const spatializeHandle = { update: vi.fn(), disconnect: vi.fn() }

vi.mock('../../src/stdlib/audio.js', () => ({
  engine: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    audioContext: {
      listener: {
        positionX: { value: 0 },
        positionY: { value: 0 },
        positionZ: { value: 0 },
        forwardX: { value: 0 },
        forwardY: { value: 0 },
        forwardZ: { value: -1 },
        upX: { value: 0 },
        upY: { value: 1 },
        upZ: { value: 0 },
      },
    },
  },
  spatialize: vi.fn(() => spatializeHandle),
}))

vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
  now: vi.fn(() => 0),
  FMSynth: vi.fn(function FMSynth() {
    return {
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      toDestination: vi.fn().mockReturnThis(),
      triggerAttackRelease: vi.fn(),
      dispose: vi.fn(),
      volume: { value: -12 },
      output: { connect: vi.fn() },
    }
  }),
}))

function makeMockCtx() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = new Three.PerspectiveCamera(60, 1, 0.1, 1000)
  camera.position.set(0, 8, 18)
  return {
    Three,
    scene,
    camera,
    renderer: { domElement: canvas, shadowMap: { enabled: false } },
    controls: { target: new Three.Vector3(), update: vi.fn(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp: vi.fn(),
    elapsed: 0,
  }
}

describe('bell-orrery', () => {
  let ctx, mod

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    spatializeHandle.update.mockClear()
    spatializeHandle.disconnect.mockClear()
    ctx = makeMockCtx()
    mod = await import('./bell-orrery.js')
  })

  afterEach(async () => {
    try { await mod.teardown(ctx) } catch (_) { /* ignore */ }
  })

  it('setup() calls setHelp and setBloom and adds orbital rings', () => {
    mod.setup(ctx)
    expect(ctx.setHelp).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(7)
    const btn = ctx.renderer.domElement.parentElement.querySelector('button')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toMatch(/Start/i)
  })

  it('update() orbits rings before audio starts', () => {
    mod.setup(ctx)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.5
      mod.update(ctx, 0.5)
    }).not.toThrow()
  })

  it('Start button starts the engine and spatializes each bell', async () => {
    const { engine, spatialize } = await import('../../src/stdlib/audio.js')
    const Tone = await import('tone')
    mod.setup(ctx)
    const btn = ctx.renderer.domElement.parentElement.querySelector('button')
    btn.click()
    await Promise.resolve()
    await Promise.resolve()
    expect(engine.start).toHaveBeenCalled()
    expect(Tone.FMSynth).toHaveBeenCalled()
    expect(spatialize).toHaveBeenCalled()
    expect(spatialize.mock.calls.length).toBe(5)
  })

  it('update() after start tracks panners to ring meshes', async () => {
    mod.setup(ctx)
    ctx.renderer.domElement.parentElement.querySelector('button').click()
    await Promise.resolve()
    await Promise.resolve()
    mod.update(ctx, 0.016)
    expect(spatializeHandle.update).toHaveBeenCalled()
  })

  it('teardown() removes UI, disconnects spatializers, and stops the engine', async () => {
    const { engine } = await import('../../src/stdlib/audio.js')
    mod.setup(ctx)
    ctx.renderer.domElement.parentElement.querySelector('button').click()
    await Promise.resolve()
    await Promise.resolve()
    const addCount = ctx.add.mock.calls.length
    await mod.teardown(ctx)
    expect(ctx.remove.mock.calls.length).toBe(addCount)
    expect(spatializeHandle.disconnect).toHaveBeenCalled()
    expect(engine.stop).toHaveBeenCalled()
    expect(ctx.renderer.domElement.parentElement.querySelector('button')).toBeNull()
  })
})

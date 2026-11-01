// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeContext } from '../../tests/context.ts'

// Panner3D instances created by the example, in construction order.
const panners: ReturnType<typeof makePanner>[] = []

function makePanner() {
  return {
    positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 },
    toDestination: vi.fn().mockReturnThis(), dispose: vi.fn(),
  }
}

vi.mock('../../src/stdlib/audio.ts', () => ({
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
  Panner3D: vi.fn(function Panner3D() {
    const panner = makePanner()
    panners.push(panner)
    return panner
  }),
}))

function makeMockCtx() {
  const ctx = makeContext()
  vi.spyOn(ctx, 'add')
  vi.spyOn(ctx, 'remove')
  vi.spyOn(ctx, 'setBloom')
  vi.spyOn(ctx, 'setHelp')
  return ctx
}

function button(ctx: ReturnType<typeof makeMockCtx>) {
  const button = ctx.renderer.domElement.parentElement?.querySelector('button')
  if (!button) throw new Error('Bell start button is missing')
  return button
}

describe('bell-orrery', () => {
  let ctx: ReturnType<typeof makeMockCtx>
  let mod: typeof import('./bell-orrery.ts')

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    panners.length = 0
    ctx = makeMockCtx()
    mod = await import('./bell-orrery.ts')
  })

  afterEach(async () => {
    await mod.teardown(ctx)
  })

  it('setup() calls setHelp and setBloom and adds orbital rings', () => {
    mod.setup(ctx)
    expect(ctx.setHelp).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
    expect(vi.mocked(ctx.add).mock.calls.length).toBeGreaterThanOrEqual(7)
    const btn = button(ctx)
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

  it('Start button starts the engine and gives every bell its own Panner3D', async () => {
    const { engine } = await import('../../src/stdlib/audio.ts')
    const Tone = await import('tone')
    mod.setup(ctx)
    const btn = button(ctx)
    btn.click()
    await Promise.resolve()
    await Promise.resolve()
    expect(engine.start).toHaveBeenCalled()
    expect(Tone.FMSynth).toHaveBeenCalled()
    // Tone sources must be panned by a Tone node, never stdlib spatialize().
    expect(vi.mocked(Tone.Panner3D).mock.calls.length).toBe(5)
    expect(panners.length).toBe(5)
    for (const p of panners) expect(p.toDestination).toHaveBeenCalled()
  })

  it('Start button hides before the engine promise settles', async () => {
    const { engine } = await import('../../src/stdlib/audio.ts')
    let release: (() => void) | undefined
    vi.mocked(engine.start).mockImplementationOnce(() => new Promise<void>(r => { release = r }))
    mod.setup(ctx)
    const btn = button(ctx)
    btn.click()
    expect(btn.style.display).toBe('none')
    if (!release) throw new Error('Audio startup did not begin')
    release()
  })

  it('Start button returns for a retry when audio init fails', async () => {
    const { engine } = await import('../../src/stdlib/audio.ts')
    vi.mocked(engine.start).mockRejectedValueOnce(new Error('no audio device'))
    mod.setup(ctx)
    const btn = button(ctx)
    btn.click()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(btn.style.display).not.toBe('none')
    expect(btn.textContent).toMatch(/retry/i)

    btn.click()
    await Promise.resolve()
    await Promise.resolve()
    expect(engine.start).toHaveBeenCalledTimes(2)
  })

  it('update() after start tracks panners to ring meshes', async () => {
    mod.setup(ctx)
    button(ctx).click()
    await Promise.resolve()
    await Promise.resolve()
    mod.update(ctx, 0.016)
    // Rings orbit off-centre, so at least one panner must hold a non-zero position.
    const moved = panners.some(p =>
      p.positionX.value !== 0 || p.positionY.value !== 0 || p.positionZ.value !== 0)
    expect(moved).toBe(true)
  })

  it('teardown() removes UI, disconnects spatializers, and stops the engine', async () => {
    const { engine } = await import('../../src/stdlib/audio.ts')
    mod.setup(ctx)
    button(ctx).click()
    await Promise.resolve()
    await Promise.resolve()
    const addCount = vi.mocked(ctx.add).mock.calls.length
    await mod.teardown(ctx)
    expect(vi.mocked(ctx.remove).mock.calls.length).toBe(addCount)
    for (const p of panners) expect(p.dispose).toHaveBeenCalled()
    expect(engine.stop).toHaveBeenCalled()
    expect(ctx.renderer.domElement.parentElement?.querySelector('button')).toBeNull()
  })
})

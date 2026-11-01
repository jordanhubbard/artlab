// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { containerOf, initializeAsync, makeSpiedContext, required } from '../../tests/context.ts'
type Demo = typeof import('./audio-terrain.ts')

vi.mock('three', async () => await vi.importActual('three'))

const mic = vi.hoisted(() => ({ start: vi.fn(), dispose: vi.fn() }))
vi.mock('../../src/stdlib/media.ts', () => ({
  MicrophoneInput: class {
    active = false
    async start() { mic.start(); this.active = true }
    update() {}
    level() { return 0.3 }
    dispose() { mic.dispose(); this.active = false }
  },
}))

describe('audio-terrain', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    base = makeSpiedContext()
    mod = await import('./audio-terrain.ts')
  })

  afterEach(async () => {
    try { await mod.teardown() } catch (_) {}
  })

  it('setup() does not throw', async () => {
    await expect(initializeAsync(mod.setup, base).then(ready => { ctx = ready })).resolves.not.toThrow()
  })

  it('setup() calls ctx.setBloom', async () => {
    ctx = await initializeAsync(mod.setup, base)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.9)
  })

  it('setup() adds terrain + 2 lights via ctx.add', async () => {
    ctx = await initializeAsync(mod.setup, base)
    // AmbientLight + HemisphereLight + terrain mesh = 3 minimum
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('setup() adds an "Enable Microphone" button to the container', async () => {
    ctx = await initializeAsync(mod.setup, base)
    const btn = required(containerOf(ctx).querySelector('button'))
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('Microphone')
  })

  it('update() runs multiple frames without throwing', async () => {
    ctx = await initializeAsync(mod.setup, base)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('update() moves camera each frame (orbit)', async () => {
    ctx = await initializeAsync(mod.setup, base)
    ctx.elapsed = 1.0
    mod.update(ctx, 0.016)
    // Camera X should be cos(0.09) * 28
    expect(ctx.camera.position.x).toBeCloseTo(Math.cos(0.09) * 28, 3)
  })

  it('clicking mic button calls microphone start()', async () => {
    ctx = await initializeAsync(mod.setup, base)
    const btn = required(containerOf(ctx).querySelector('button'))
    btn.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(mic.start).toHaveBeenCalled()
  })

  it('teardown() does not throw', async () => {
    ctx = await initializeAsync(mod.setup, base)
    await expect(mod.teardown()).resolves.not.toThrow()
  })

  it('teardown() removes terrain + lights via ctx.remove', async () => {
    ctx = await initializeAsync(mod.setup, base)
    await mod.teardown()
    // terrain + ambLight + hemiLight = 3 minimum
    expect(ctx.remove.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('teardown() removes the mic button from DOM', async () => {
    ctx = await initializeAsync(mod.setup, base)
    expect(containerOf(ctx).querySelector('button')).not.toBeNull()
    await mod.teardown()
    expect(containerOf(ctx).querySelector('button')).toBeNull()
  })

  it('teardown() calls microphone disposal when mic was enabled', async () => {
    ctx = await initializeAsync(mod.setup, base)
    // Simulate mic button click to set _audioOn = true
    const btn = required(containerOf(ctx).querySelector('button'))
    btn.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    await mod.teardown()
    expect(mic.dispose).toHaveBeenCalled()
  })

  it('teardown() followed by setup() does not throw (state reset)', async () => {
    ctx = await initializeAsync(mod.setup, base)
    await mod.teardown()
    const ctx2 = makeSpiedContext()
    await expect(mod.setup(ctx2)).resolves.not.toThrow()
    await mod.teardown()
  })
})

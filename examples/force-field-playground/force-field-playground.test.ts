// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./force-field-playground.ts')

vi.mock('three', async () => await vi.importActual('three'))

vi.mock('../../src/stdlib/physics/particles.ts', () => ({
  createParticleWorld: () => ({
    addBody:      vi.fn(),
    removeBody:   vi.fn(),
    getParticles: vi.fn(() => []),
    step:         vi.fn(),
  }),
  emitter: (world: unknown, scene: Three.Scene) => {
    const geometry = new Three.BufferGeometry()
    const material = new Three.PointsMaterial()
    const points = new Three.Points(geometry, material)
    scene.add(points)
    return {
      emitterId: 'emitter_0',
      points,
      update:  vi.fn(),
      dispose: vi.fn(() => scene.remove(points)),
    }
  },
  forceField: vi.fn(),
}))

vi.mock('../../src/stdlib/ui.ts', () => ({
  label: vi.fn(() => ({
    label:      {},
    setText:    vi.fn(),
    setOpacity: vi.fn(),
    detach:     vi.fn(),
  })),
  hud: vi.fn(() => ({
    el:      document.createElement('div'),
    setText: vi.fn(),
    setHTML: vi.fn(),
    show:    vi.fn(),
    hide:    vi.fn(),
    dispose: vi.fn(),
  })),
}))

describe('force-field-playground', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    base = makeSpiedContext()
    mod = await import('./force-field-playground.ts')
  })

  it('setup runs without throwing', () => {
    expect(() => (ctx = initialize(mod.setup, base))).not.toThrow()
  })

  it('setup calls ctx.setBloom', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx.setBloom).toHaveBeenCalledWith(1.4)
  })

  it('setup adds lights and ground plane via ctx.add', () => {
    ctx = initialize(mod.setup, base)
    // ambientLight + ptLight + groundPlane = 3
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('update runs without throwing', () => {
    ctx = initialize(mod.setup, base)
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('update runs 3 frames without throwing', () => {
    ctx = initialize(mod.setup, base)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('click event does not throw', () => {
    ctx = initialize(mod.setup, base)
    expect(() => {
      window.dispatchEvent(new MouseEvent('click', { clientX: 400, clientY: 300, bubbles: true }))
    }).not.toThrow()
  })

  it('teardown does not throw', () => {
    ctx = initialize(mod.setup, base)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown removes all objects added via ctx.add', () => {
    ctx = initialize(mod.setup, base)
    mod.teardown(ctx)
    // groundPlane + ambientLight + ptLight = 3 removes minimum
    expect(ctx.remove.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('teardown removes the event listener (second teardown does not throw)', () => {
    ctx = initialize(mod.setup, base)
    mod.teardown(ctx)
    // Re-setup then teardown again should not throw
    ctx = initialize(mod.setup, base)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })
})

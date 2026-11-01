// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./domino-chain.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('domino-chain', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./domino-chain.ts'))
  })

  it('setup() completes without throwing', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() creates 20 dominoes with physics state', () => {
    ctx = initialize(setup, base)
    expect(Array.isArray(ctx._dominoes)).toBe(true)
    expect(ctx._dominoes.length).toBe(20)
    for (const d of ctx._dominoes) {
      expect(d).toHaveProperty('position')
      expect(d).toHaveProperty('velocity')
      expect(d).toHaveProperty('_mesh')
      expect(d._fallen).toBe(false)
    }
  })

  it('update() runs without throwing before and after topple', () => {
    ctx = initialize(setup, base)
    expect(() => update(ctx, 0.016)).not.toThrow()
    // Trigger topple via click
    ctx.renderer.domElement.dispatchEvent(new Event('click'))
    expect(ctx._started).toBe(true)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('teardown() removes event listener and objects', () => {
    ctx = initialize(setup, base)
    const removeSpy = vi.spyOn(ctx.renderer.domElement, 'removeEventListener')
    teardown(ctx)
    expect(removeSpy).toHaveBeenCalledWith('click', ctx._onClick)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

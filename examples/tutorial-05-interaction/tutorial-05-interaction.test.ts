// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
import { setup, teardown, update } from './tutorial-05-interaction.ts'
type Demo = typeof import('./tutorial-05-interaction.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('tutorial-05-interaction', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>

  beforeEach(() => {
    base = makeSpiedContext()
  })

  afterEach(() => {
    // Clean up any lingering event listeners if teardown wasn't called
    if (ctx._onMouseMove) window.removeEventListener('mousemove', ctx._onMouseMove)
    if (ctx._onClick) window.removeEventListener('click', ctx._onClick)
    if (ctx._onKey) window.removeEventListener('keydown', ctx._onKey)
  })

  it('setup() does not throw', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
  })

  it('creates a 5x5 grid of 25 cubes after setup', () => {
    ctx = initialize(setup, base)
    expect(Array.isArray(ctx._cubes)).toBe(true)
    expect(ctx._cubes.length).toBe(25)
  })

  it('update() runs 3 frames without throwing', () => {
    ctx = initialize(setup, base)
    for (let i = 1; i <= 3; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() removes event listeners and does not throw', () => {
    ctx = initialize(setup, base)

    // Spy on removeEventListener to verify it is called
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    expect(() => teardown(ctx)).not.toThrow()

    const calls = removeSpy.mock.calls.map(c => c[0])
    expect(calls).toContain('mousemove')
    expect(calls).toContain('click')
    expect(calls).toContain('keydown')

    removeSpy.mockRestore()
  })
})

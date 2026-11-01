// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
import { setup, teardown, update } from './tutorial-04-color.ts'
type Demo = typeof import('./tutorial-04-color.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('tutorial-04-color', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>

  beforeEach(() => {
    base = makeSpiedContext()
  })

  it('setup() does not throw', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
  })

  it('creates a 4x4 grid of 16 spheres after setup', () => {
    ctx = initialize(setup, base)
    expect(Array.isArray(ctx._spheres)).toBe(true)
    expect(ctx._spheres.length).toBe(16)
  })

  it('update() runs 3 frames without throwing', () => {
    ctx = initialize(setup, base)
    for (let i = 1; i <= 3; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() does not throw', () => {
    ctx = initialize(setup, base)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

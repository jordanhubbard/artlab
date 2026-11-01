// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
import { setup, teardown, update } from './tutorial-03-animation.ts'
type Demo = typeof import('./tutorial-03-animation.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('tutorial-03-animation', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>

  beforeEach(() => {
    base = makeSpiedContext()
  })

  it('setup() does not throw', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
  })

  it('creates 3 animated objects after setup', () => {
    ctx = initialize(setup, base)
    expect(Array.isArray(ctx._objs)).toBe(true)
    expect(ctx._objs.length).toBe(3)
  })

  it('update() runs 3 frames with increasing elapsed without throwing', () => {
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

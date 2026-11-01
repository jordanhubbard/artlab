// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
import { setup, teardown, update } from './tutorial-02-lights.ts'
type Demo = typeof import('./tutorial-02-lights.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('tutorial-02-lights', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>

  beforeEach(() => {
    base = makeSpiedContext()
  })

  it('setup() does not throw', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
  })

  it('_lights array exists and is populated after setup', () => {
    ctx = initialize(setup, base)
    expect(Array.isArray(ctx._lights)).toBe(true)
    expect(ctx._lights.length).toBeGreaterThan(0)
  })

  it('update() cycles modes across 3 frames at increasing elapsed time', () => {
    ctx = initialize(setup, base)
    // Advance past CYCLE_DURATION (4s) to trigger a mode change
    ctx.elapsed = 4.1
    expect(() => update(ctx, 0.016)).not.toThrow()
    // Advance past another cycle
    ctx.elapsed = 8.2
    expect(() => update(ctx, 0.016)).not.toThrow()
    ctx.elapsed = 12.3
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('teardown() does not throw', () => {
    ctx = initialize(setup, base)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

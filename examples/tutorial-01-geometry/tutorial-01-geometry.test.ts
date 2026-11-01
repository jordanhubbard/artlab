// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
import { setup, teardown, update } from './tutorial-01-geometry.ts'
type Demo = typeof import('./tutorial-01-geometry.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('tutorial-01-geometry', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>

  beforeEach(() => {
    base = makeSpiedContext()
  })

  it('setup() does not throw', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
  })

  it('creates 5 meshes and 5 labels after setup', () => {
    ctx = initialize(setup, base)
    expect(ctx._meshes.length).toBe(5)
    expect(ctx._labels.length).toBe(5)
  })

  it('update() runs 3 frames without throwing', () => {
    ctx = initialize(setup, base)
    for (let i = 0; i < 3; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() does not throw', () => {
    ctx = initialize(setup, base)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

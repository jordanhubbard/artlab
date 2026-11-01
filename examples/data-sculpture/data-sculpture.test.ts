// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./data-sculpture.ts')

vi.mock('three', async () => await vi.importActual('three'))

// ── Mock ctx ──────────────────────────────────────────────────────────────────

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('data-sculpture', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./data-sculpture.ts'))
  })

  afterEach(() => {
    teardown(ctx)
  })

  it('setup() completes without throwing', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
  })

  it('setup() adds 2 lights + 5 anchors + 60 bars = 67 objects', () => {
    ctx = initialize(setup, base)
    // 2 lights + 5 city anchors + (5 cities × 12 months) bars
    expect(ctx.add).toHaveBeenCalledTimes(67)
  })

  it('update() runs multiple frames without throwing', () => {
    ctx = initialize(setup, base)
    for (const elapsed of [0, 0.016, 0.5, 2.0]) {
      ctx.elapsed = elapsed
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() runs without throwing', () => {
    ctx = initialize(setup, base)
    expect(() => teardown(ctx)).not.toThrow()
  })

  it('teardown() removes every object added during setup()', () => {
    ctx = initialize(setup, base)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(67)
  })

  it('teardown() is idempotent — calling twice does not throw', () => {
    ctx = initialize(setup, base)
    teardown(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

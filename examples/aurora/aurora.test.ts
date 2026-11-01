// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./aurora.ts')

vi.mock('three', async () => await vi.importActual('three'))

// ── Mock ctx ──────────────────────────────────────────────────────────────────

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('aurora', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"]

  beforeEach(async () => {
    base = makeSpiedContext()
    ;({ setup, update } = await import('./aurora.ts'))
  })

  it('setup() completes without throwing', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() populates _panels and _stars arrays', () => {
    ctx = initialize(setup, base)
    expect(Array.isArray(ctx._panels)).toBe(true)
    expect(ctx._panels.length).toBeGreaterThan(0)
    expect(Array.isArray(ctx._stars)).toBe(true)
    expect(ctx._stars.length).toBeGreaterThan(0)
  })

  it('update() runs 3 frames without throwing', () => {
    ctx = initialize(setup, base)
    const frames = [0, 0.016, 0.032]
    for (const elapsed of frames) {
      ctx.elapsed = elapsed
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })
})

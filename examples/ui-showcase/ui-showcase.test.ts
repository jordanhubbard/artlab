// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { containerOf, initialize, makeSpiedContext, required } from '../../tests/context.ts'
type Demo = typeof import('./ui-showcase.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('ui-showcase', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    // Clean up DOM between tests
    document.body.innerHTML = ''
    vi.clearAllMocks()
    base = makeSpiedContext()
    mod = await import('./ui-showcase.ts')
  })

  it('setup() does not throw', () => {
    expect(() => (ctx = initialize(mod.setup, base))).not.toThrow()
  })

  it('setup() adds meshes via ctx.add', () => {
    ctx = initialize(mod.setup, base)
    // Lights (3) + 6 meshes = at least 7 adds
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(7)
  })

  it('setup() appends a control panel to the container', () => {
    ctx = initialize(mod.setup, base)
    const container = containerOf(ctx)
    // The panel has a known id-less div but contains '#ui-stats'
    const statsEl = required(container.querySelector('#ui-stats'))
    expect(statsEl).not.toBeNull()
  })

  it('setup() appends a tooltip element to the container', () => {
    ctx = initialize(mod.setup, base)
    const container = containerOf(ctx)
    // Tooltip is a div with pointerEvents:none
    const divs = container.querySelectorAll('div')
    expect(divs.length).toBeGreaterThan(1)
  })

  it('update() runs 3 frames without throwing', () => {
    ctx = initialize(mod.setup, base)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('update() updates the stat panel content', () => {
    ctx = initialize(mod.setup, base)
    ctx.elapsed = 1.5
    mod.update(ctx, 0.016)
    const container = containerOf(ctx)
    const statsEl = required(container.querySelector('#ui-stats'))
    expect(statsEl.innerHTML).toContain('elapsed')
    expect(statsEl.innerHTML).toContain('objects')
  })

  it('teardown() does not throw', () => {
    ctx = initialize(mod.setup, base)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() removes the panel from the DOM', () => {
    ctx = initialize(mod.setup, base)
    const container = containerOf(ctx)
    expect(container.querySelector('#ui-stats')).not.toBeNull()
    mod.teardown(ctx)
    // panel.remove() is called, so #ui-stats should be gone
    expect(container.querySelector('#ui-stats')).toBeNull()
  })

  it('teardown() calls ctx.remove for all meshes', () => {
    ctx = initialize(mod.setup, base)
    mod.teardown(ctx)
    // 6 OBJECTS → 6 removes
    expect(ctx.remove.mock.calls.length).toBeGreaterThanOrEqual(6)
  })
})

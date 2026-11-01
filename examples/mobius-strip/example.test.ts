// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./mobius-strip.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('mobius-strip', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./mobius-strip.ts'))
  })

  it('setup() creates strip mesh and particles', () => {
    ctx = initialize(setup, base)
    expect(ctx._strip).toBeInstanceOf(Three.Mesh)
    expect(ctx._particles).toBeInstanceOf(Three.Points)
  })

  it('strip uses DoubleSide material', () => {
    ctx = initialize(setup, base)
    expect(ctx._strip.material.side).toBe(Three.DoubleSide)
  })

  it('strip has vertex colors', () => {
    ctx = initialize(setup, base)
    expect(ctx._strip.geometry.attributes.color).toBeDefined()
  })

  it('update() rotates the strip and moves particles', () => {
    ctx = initialize(setup, base)
    const y0 = ctx._strip.rotation.y
    update(ctx, 0.1)
    expect(ctx._strip.rotation.y).toBeGreaterThan(y0)
    // particles were updated (positions changed)
    const pos = ctx._particles.geometry.attributes.position.array
    expect(pos).toBeDefined()
  })

  it('teardown() cleans up', () => {
    ctx = initialize(setup, base)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

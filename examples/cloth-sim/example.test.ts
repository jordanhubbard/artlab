// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./cloth-sim.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('cloth-sim', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./cloth-sim.ts'))
  })

  it('setup() creates cloth mesh and particles', () => {
    ctx = initialize(setup, base)
    expect(ctx._clothMesh).toBeInstanceOf(Three.Mesh)
    expect(ctx._cloth.particles.length).toBe(30 * 24)
  })

  it('cloth has structural constraints', () => {
    ctx = initialize(setup, base)
    expect(ctx._cloth.constraints.length).toBeGreaterThan(0)
  })

  it('some particles are pinned at top row', () => {
    ctx = initialize(setup, base)
    const pinned = ctx._cloth.particles.filter(p => p.pinned)
    expect(pinned.length).toBeGreaterThan(0)
  })

  it('update() moves non-pinned particles via gravity', () => {
    ctx = initialize(setup, base)
    const bottomParticle = ctx._cloth.particles[ctx._cloth.particles.length - 1]
    const y0 = bottomParticle.pos.y
    update(ctx, 0.016)
    // Gravity pulls down
    expect(bottomParticle.pos.y).not.toBe(y0)
  })

  it('pinned particles stay in place', () => {
    ctx = initialize(setup, base)
    const pinned = ctx._cloth.particles.find(p => p.pinned)
    if (!pinned) throw new Error('Cloth did not initialize a pinned particle')
    const y0 = pinned.pos.y
    update(ctx, 0.016)
    expect(pinned.pos.y).toBe(y0)
  })

  it('teardown() cleans up', () => {
    ctx = initialize(setup, base)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

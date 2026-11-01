// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./marble-run.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('marble-run', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./marble-run.ts'))
  })

  it('setup() creates ramps and bowl', () => {
    ctx = initialize(setup, base)
    expect(ctx._rampMeshes.length).toBe(6)
    expect(ctx._bowl).toBeInstanceOf(Three.Mesh)
    expect(ctx._marbles).toHaveLength(0)
  })

  it('update() spawns marbles over time', () => {
    ctx = initialize(setup, base)
    // Simulate enough time to spawn
    for (let i = 0; i < 100; i++) update(ctx, 0.02)
    expect(ctx._marbles.length).toBeGreaterThan(0)
  })

  it('marbles have physics (fall with gravity)', () => {
    ctx = initialize(setup, base)
    // Force spawn
    ctx._spawnTimer = 10
    update(ctx, 0.016)
    expect(ctx._marbles.length).toBe(1)
    const y0 = ctx._marbles[0].pos.y
    update(ctx, 0.1)
    expect(ctx._marbles[0].pos.y).toBeLessThan(y0)
  })

  it('marbles have metallic shiny material', () => {
    ctx = initialize(setup, base)
    ctx._spawnTimer = 10
    update(ctx, 0.016)
    expect(ctx._marbles[0].mesh.material.metalness).toBeGreaterThan(0.5)
  })

  it('teardown() cleans up everything', () => {
    ctx = initialize(setup, base)
    ctx._spawnTimer = 10
    update(ctx, 0.016)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

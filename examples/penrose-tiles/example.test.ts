// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./penrose-tiles.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('penrose-tiles', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./penrose-tiles.ts'))
  })

  it('setup() creates tile meshes from deflation', () => {
    ctx = initialize(setup, base)
    expect(ctx._tileMeshes.length).toBeGreaterThan(100)
    expect(ctx._triangles.length).toBe(ctx._tileMeshes.length)
  })

  it('tiles start below screen for rise animation', () => {
    ctx = initialize(setup, base)
    expect(ctx._tileMeshes[0].position.y).toBe(-5)
  })

  it('update() advances animation and cycles colors', () => {
    ctx = initialize(setup, base)
    update(ctx, 0.1)
    expect(ctx._animTime).toBeGreaterThan(0)
    expect(ctx._tileMeshes[0].position.y).toBeGreaterThan(-5)
  })

  it('has both thin and thick triangle types', () => {
    ctx = initialize(setup, base)
    const types = new Set(ctx._triangles.map(t => t.type))
    expect(types.has(0)).toBe(true)
    expect(types.has(1)).toBe(true)
  })

  it('teardown() cleans up all tile meshes', () => {
    ctx = initialize(setup, base)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(ctx._tileMeshes.length + 2) // tiles + lights
  })
})

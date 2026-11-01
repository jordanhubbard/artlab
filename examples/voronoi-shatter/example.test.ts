// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./voronoi-shatter.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('voronoi-shatter', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./voronoi-shatter.ts'))
  })

  it('setup() completes and creates initial cells', () => {
    ctx = initialize(setup, base)
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx._cellMeshes.length).toBeGreaterThan(0)
    expect(ctx._seeds.length).toBe(8)
  })

  it('cells are ExtrudeGeometry meshes', () => {
    ctx = initialize(setup, base)
    for (const m of ctx._cellMeshes) {
      expect(m).toBeInstanceOf(Three.Mesh)
    }
  })

  it('update() without shatter does nothing', () => {
    ctx = initialize(setup, base)
    const y0 = ctx._cellMeshes[0].position.y
    update(ctx, 0.016)
    expect(ctx._cellMeshes[0].position.y).toBe(y0)
  })

  it('update() after shatter moves cells', () => {
    ctx = initialize(setup, base)
    ctx._shattered = true
    for (const p of ctx._physics) {
      p.vx = 1; p.vy = 5; p.vz = 1
      p.rx = 1; p.ry = 1; p.rz = 1
    }
    update(ctx, 0.1)
    expect(ctx._cellMeshes[0].position.y).not.toBe(0)
  })

  it('teardown() removes all cells', () => {
    ctx = initialize(setup, base)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

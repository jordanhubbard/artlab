// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./recursive-spirals.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('recursive-spirals', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./recursive-spirals.ts'))
  })

  it('setup() generates thousands of spiral particles', () => {
    ctx = initialize(setup, base)
    expect(ctx._particleCount).toBeGreaterThan(500)
    expect(ctx._points).toBeInstanceOf(Three.Points)
  })

  it('particles use additive blending', () => {
    ctx = initialize(setup, base)
    expect(ctx._points.material.blending).toBe(Three.AdditiveBlending)
  })

  it('update() rotates and animates particles', () => {
    ctx = initialize(setup, base)
    const z0 = ctx._points.rotation.z
    update(ctx, 0.1)
    expect(ctx._points.rotation.z).toBeGreaterThan(z0)
    // positions were updated
    const pos = ctx._points.geometry.attributes.position.array
    expect(pos).toBeDefined()
  })

  it('teardown() removes and disposes', () => {
    ctx = initialize(setup, base)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})

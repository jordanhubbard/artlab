// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext, required } from '../../tests/context.ts'
import { FlowParticles } from './FlowParticles.ts'
type Demo = typeof import('./flow-field.ts')

function points(ctx: DemoContext<Demo>): Three.Points<Three.BufferGeometry, Three.PointsMaterial> {
  const object = required(ctx.add.mock.calls.find(([obj]) => obj instanceof Three.Points))[0]
  if (!(object instanceof Three.Points) || !(object.material instanceof Three.PointsMaterial)) throw new Error('Expected particle points')
  return Object.assign(object, { material: object.material })
}

vi.mock('three', async () => await vi.importActual('three'))

describe('flow-field', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./flow-field.ts'))
  })

  it('setup() completes without throwing', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates Points with position and color attributes', () => {
    ctx = initialize(setup, base)
    expect(points(ctx)).toBeInstanceOf(Three.Points)
    const geo = points(ctx).geometry
    expect(geo.attributes.position).toBeDefined()
    expect(geo.attributes.color).toBeDefined()
    expect(geo.attributes.position.count).toBe(4000)
    expect(geo.attributes.color.count).toBe(4000)
  })

  it('setup() uses additive blending', () => {
    ctx = initialize(setup, base)
    expect(points(ctx).material.blending).toBe(Three.AdditiveBlending)
  })

  it('update() runs multiple frames without throwing', () => {
    ctx = initialize(setup, base)
    for (let i = 0; i < 20; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('particle positions change after update', () => {
    ctx = initialize(setup, base)
    const posBefore = points(ctx).geometry.attributes.position.array[0]
    update(ctx, 0.016)
    update(ctx, 0.016)
    expect(points(ctx).geometry.attributes.position.array[0]).not.toBe(posBefore)
  })

  it('particles respawn when alpha fades out', () => {
    const field = new FlowParticles({ count: 4 })
    field.alpha[0] = 0.001
    field.update(0.016, 0)
    expect(field.alpha[0]).toBeGreaterThan(0.5)
    expect(Math.abs(field.positions[0])).toBeLessThanOrEqual(50)
    field.dispose()
  })

  it('teardown() removes points and disposes', () => {
    ctx = initialize(setup, base)
    const geoDispose = vi.spyOn(points(ctx).geometry, 'dispose')
    const matDispose = vi.spyOn(points(ctx).material, 'dispose')
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(points(ctx))
    expect(geoDispose).toHaveBeenCalled()
    expect(matDispose).toHaveBeenCalled()
  })
})

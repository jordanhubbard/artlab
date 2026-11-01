// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./shader-playground.ts')

vi.mock('three', async () => await vi.importActual('three'))

function surface(ctx: DemoContext<Demo>): Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial> {
  const mesh = ctx.scene.children[0]
  if (!(mesh instanceof Three.Mesh) || !(mesh.material instanceof Three.ShaderMaterial)) throw new Error('Expected shader surface')
  return Object.assign(mesh, { material: mesh.material })
}

describe('shader-playground', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./shader-playground.ts'))
  })

  it('setup() completes without throwing', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates quad with ShaderMaterial and uniforms', () => {
    ctx = initialize(setup, base)
    expect(surface(ctx)).toBeInstanceOf(Three.Mesh)
    expect(surface(ctx).material).toBeInstanceOf(Three.ShaderMaterial)
    expect(surface(ctx).material.uniforms.uTime).toBeDefined()
    expect(surface(ctx).material.uniforms.uResolution).toBeDefined()
  })

  it('update() advances uTime uniform', () => {
    ctx = initialize(setup, base)
    ctx.elapsed = 1.5
    update(ctx, 0.016)
    expect(surface(ctx).material.uniforms.uTime.value).toBe(1.5)
  })

  it('update() runs 5 frames without throwing', () => {
    ctx = initialize(setup, base)
    for (let i = 0; i < 5; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() removes and disposes its shader surface', async () => {
    ctx = initialize(setup, base)
    const quad = surface(ctx)
    const geometry = vi.spyOn(quad.geometry, 'dispose')
    const material = vi.spyOn(quad.material, 'dispose')
    await teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(quad)
    expect(geometry).toHaveBeenCalledTimes(1)
    expect(material).toHaveBeenCalledTimes(1)
  })
})

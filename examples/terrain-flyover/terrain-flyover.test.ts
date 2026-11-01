// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { makeSpiedContext as makeCtx } from '../../tests/context.ts'
import { setup, teardown, update } from './terrain-flyover.ts'

describe('terrain-flyover', () => {
  let ctx: ReturnType<typeof makeCtx>

  beforeEach(() => {
    ctx = makeCtx()
  })

  it('setup runs without throwing', async () => {
    await expect(setup(ctx)).resolves.toBeUndefined()
  })

  it('setup adds terrain, sun, and ambient via ctx.add', async () => {
    await setup(ctx)
    expect(ctx.add).toHaveBeenCalledTimes(3)
  })

  it('setup positions the camera', async () => {
    await setup(ctx)
    expect(ctx.camera.position.set).toHaveBeenCalledWith(-85, 22, -55)
  })

  it('setup sets scene fog', async () => {
    await setup(ctx)
    expect(ctx.scene.fog).not.toBeNull()
  })

  it('setup creates terrain mesh with vertex colors', async () => {
    await setup(ctx)
    const terrainMesh = ctx.add.mock.calls[0][0]
    if (!(terrainMesh instanceof ctx.Three.Mesh)) throw new Error('Terrain did not initialize a mesh')
    expect(terrainMesh.geometry.attributes.color).toBeDefined()
    expect(terrainMesh.geometry.attributes.color.count).toBeGreaterThan(0)
  })

  it('update runs without throwing', async () => {
    await setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('update moves camera along spline', async () => {
    await setup(ctx)
    update(ctx, 0.016)
    expect(ctx.camera.position.set).toHaveBeenCalledTimes(2) // once in setup, once in update
    expect(ctx.camera.lookAt).toHaveBeenCalled()
  })

  it('update runs multiple frames without throwing', async () => {
    await setup(ctx)
    for (let i = 0; i < 60; i++) {
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown removes exactly the objects added via ctx.add', async () => {
    await setup(ctx)
    const addCount = ctx.add.mock.calls.length
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(addCount)
  })

  it('teardown clears scene fog', async () => {
    await setup(ctx)
    teardown(ctx)
    expect(ctx.scene.fog).toBeNull()
  })

  it('teardown can be called twice without throwing', async () => {
    await setup(ctx)
    teardown(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

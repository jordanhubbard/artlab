import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setup, update, teardown } from './terrain-flyover.js'

function makeCtx(overrides = {}) {
  return {
    scene: { fog: null },
    camera: {
      position: { set: vi.fn() },
      lookAt: vi.fn(),
    },
    renderer: { shadowMap: {} },
    controls: { target: { set: vi.fn() } },
    add: vi.fn(),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('terrain-flyover', () => {
  let ctx

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

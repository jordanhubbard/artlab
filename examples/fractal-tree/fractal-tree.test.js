import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setup, update, teardown } from './fractal-tree.js'

function makeCtx(overrides = {}) {
  return {
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

describe('fractal-tree', () => {
  let ctx

  beforeEach(() => {
    ctx = makeCtx()
  })

  it('setup runs without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
  })

  it('setup adds lights and root group via ctx.add', () => {
    setup(ctx)
    // ambient + directional + rootGroup = 3 top-level ctx.add calls
    expect(ctx.add).toHaveBeenCalledTimes(3)
  })

  it('setup positions the camera', () => {
    setup(ctx)
    expect(ctx.camera.position.set).toHaveBeenCalledWith(0, 5, 14)
    expect(ctx.camera.lookAt).toHaveBeenCalled()
  })

  it('update runs without throwing at elapsed=0', () => {
    setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('update runs without throwing mid-growth', () => {
    ctx.elapsed = 5
    setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('update runs without throwing after full growth', () => {
    ctx.elapsed = 12
    setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('teardown removes exactly the objects added via ctx.add', () => {
    setup(ctx)
    const addCount = ctx.add.mock.calls.length
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(addCount)
  })

  it('teardown can be called repeatedly without throwing', () => {
    setup(ctx)
    teardown(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

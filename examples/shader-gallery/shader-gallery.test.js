// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Provide a minimal canvas 2D stub so jsdom doesn't spam "not implemented" warnings.
// Any method call returns the proxy itself so chained calls like
// createRadialGradient().addColorStop() work without throwing.
const _fake2d = new Proxy({}, {
  get() { return () => _fake2d },
  set() { return true },
})
HTMLCanvasElement.prototype.getContext = function (type) {
  if (type === '2d') return _fake2d
  return null
}

import { setup, update, teardown } from './shader-gallery.js'

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

describe('shader-gallery', () => {
  let ctx

  beforeEach(() => {
    ctx = makeCtx()
  })

  it('setup runs without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
  })

  it('setup adds ambient light and gallery group via ctx.add', () => {
    setup(ctx)
    // ambientLight + galleryGroup = 2
    expect(ctx.add).toHaveBeenCalledTimes(2)
  })

  it('setup positions the camera', () => {
    setup(ctx)
    expect(ctx.camera.position.set).toHaveBeenCalledWith(0, 2.5, 7)
    expect(ctx.camera.lookAt).toHaveBeenCalled()
  })

  it('setup sets orbit controls target', () => {
    setup(ctx)
    expect(ctx.controls.target.set).toHaveBeenCalledWith(0, 2, 0)
  })

  it('update runs without throwing at elapsed=0', () => {
    setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('update runs without throwing mid-animation', () => {
    ctx.elapsed = 5
    setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('update runs without throwing at large elapsed', () => {
    ctx.elapsed = 60
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

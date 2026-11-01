// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { canvas2D, initialize, makeSpiedContext, mockCanvas2D } from '../../tests/context.ts'
type Demo = typeof import('./shader-gallery.ts')

// Provide a minimal canvas 2D stub so jsdom doesn't spam "not implemented" warnings.
// Any method call returns the proxy itself so chained calls like
// createRadialGradient().addColorStop() work without throwing.
const _fake2d = new Proxy({}, {
  get() { return () => _fake2d },
  set() { return true },
})
mockCanvas2D(() => canvas2D(_fake2d))

import { setup, teardown, update } from './shader-gallery.ts'

describe('shader-gallery', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>

  beforeEach(() => {
    base = makeSpiedContext()
  })

  it('setup runs without throwing', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
  })

  it('setup adds ambient light and gallery group via ctx.add', () => {
    ctx = initialize(setup, base)
    // ambientLight + galleryGroup = 2
    expect(ctx.add).toHaveBeenCalledTimes(2)
  })

  it('setup positions the camera', () => {
    ctx = initialize(setup, base)
    expect(ctx.camera.position.set).toHaveBeenCalledWith(0, 2.5, 7)
    expect(ctx.camera.lookAt).toHaveBeenCalled()
  })

  it('setup sets orbit controls target', () => {
    ctx = initialize(setup, base)
    expect(ctx.controls.target.set).toHaveBeenCalledWith(0, 2, 0)
  })

  it('update runs without throwing at elapsed=0', () => {
    ctx = initialize(setup, base)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('update runs without throwing mid-animation', () => {
    ctx.elapsed = 5
    ctx = initialize(setup, base)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('update runs without throwing at large elapsed', () => {
    ctx.elapsed = 60
    ctx = initialize(setup, base)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('teardown removes exactly the objects added via ctx.add', () => {
    ctx = initialize(setup, base)
    const addCount = ctx.add.mock.calls.length
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(addCount)
  })

  it('teardown can be called repeatedly without throwing', () => {
    ctx = initialize(setup, base)
    teardown(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

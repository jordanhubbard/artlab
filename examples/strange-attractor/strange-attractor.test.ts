// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSpiedContext as makeCtx } from '../../tests/context.ts'

vi.mock('three', async () => await vi.importActual('three'))

describe('strange-attractor', () => {
  let ctx: ReturnType<typeof makeCtx>
  let mod: typeof import('./strange-attractor.ts')

  beforeEach(async () => {
    ctx = makeCtx()
    mod = await import('./strange-attractor.ts')
  })

  it('setup runs without throwing', async () => {
    await mod.setup(ctx)
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup adds 5 objects: ambient, trail, axes, sphere, light', async () => {
    await mod.setup(ctx)
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(5)
  })

  it('setup calls setBloom', async () => {
    await mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('update runs one frame without throwing', async () => {
    await mod.setup(ctx)
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('update runs 30 frames without throwing', async () => {
    await mod.setup(ctx)
    expect(() => {
      for (let i = 0; i < 30; i++) {
        ctx.elapsed = i * 0.016
        mod.update(ctx, 0.016)
      }
    }).not.toThrow()
  })

  it('teardown does not throw', async () => {
    await mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown removes all 5 added objects', async () => {
    await mod.setup(ctx)
    mod.teardown(ctx)
    expect(ctx.remove.mock.calls.length).toBeGreaterThanOrEqual(5)
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { setup, update, teardown } from './clock-3d.js'

vi.mock('three', async () => await vi.importActual('three'))

function makeCtx(overrides = {}) {
  return {
    camera: { position: { set: vi.fn() }, lookAt: vi.fn() },
    controls: { target: { set: vi.fn() } },
    add: vi.fn(),
    remove: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('clock-3d', () => {
  it('setup runs without throwing', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup adds exactly three top-level objects (group + 2 lights)', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    // ambientLight, keyLight, clockGroup
    expect(ctx.add).toHaveBeenCalledTimes(3)
  })

  it('update runs on fresh frame without throwing', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('update runs across several frames without throwing', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    for (let i = 0; i < 10; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown removes all added objects', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(3)
  })

  it('teardown can be called after update', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    update(ctx, 0.016)
    expect(() => teardown(ctx)).not.toThrow()
  })

  it('works without controls (controls is undefined)', () => {
    const ctx = makeCtx({ controls: undefined })
    expect(() => setup(ctx)).not.toThrow()
  })
})

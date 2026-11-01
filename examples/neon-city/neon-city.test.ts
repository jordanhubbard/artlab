// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { makeSpiedContext, mockCanvas2D } from '../../tests/context.ts'
import { setup, teardown, update } from './neon-city.ts'
type Demo = typeof import('./neon-city.ts')

vi.mock('three', async () => await vi.importActual('three'))

// Suppress jsdom's "not implemented" warnings for canvas.getContext('2d').
// makeWindowTex already guards against a null context, so this just keeps
// test output clean.
mockCanvas2D(() => {
  return {
      fillStyle: '',
      fillRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    }
})

describe('neon-city', () => {
  it('setup runs without throwing', async () => {
    const ctx = makeSpiedContext()
    await expect(setup(ctx)).resolves.toBeUndefined()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalledWith(1.2)
  })

  it('setup applies fog and bloom', async () => {
    const ctx = makeSpiedContext()
    await setup(ctx)
    expect(ctx.scene.fog).not.toBeNull()
    expect(ctx.setBloom).toHaveBeenCalledWith(1.2)
  })

  it('update runs without throwing', async () => {
    const ctx = makeSpiedContext()
    await setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('teardown removes every object added during setup', async () => {
    const ctx = makeSpiedContext()
    await setup(ctx)
    const addCount = ctx.add.mock.calls.length
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(addCount)
  })

  it('teardown restores scene fog and background', async () => {
    const ctx = makeSpiedContext()
    await setup(ctx)
    teardown(ctx)
    expect(ctx.scene.fog).toBeNull()
    expect(ctx.scene.background).toBeNull()
  })
})

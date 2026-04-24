// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { setup, update, teardown } from './neon-city.js'

vi.mock('three', async () => await vi.importActual('three'))

// Suppress jsdom's "not implemented" warnings for canvas.getContext('2d').
// makeWindowTex already guards against a null context, so this just keeps
// test output clean.
HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
  if (type === '2d') {
    return {
      fillStyle: '',
      fillRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    }
  }
  return null
})

function makeCtx(overrides = {}) {
  return {
    scene: {
      fog: null,
      background: null,
    },
    camera: {
      position: { set: vi.fn() },
      lookAt: vi.fn(),
    },
    controls: { enabled: true },
    add: vi.fn(),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('neon-city', () => {
  it('setup runs without throwing', async () => {
    const ctx = makeCtx()
    await expect(setup(ctx)).resolves.toBeUndefined()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalledWith(1.2)
  })

  it('setup applies fog and bloom', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    expect(ctx.scene.fog).not.toBeNull()
    expect(ctx.setBloom).toHaveBeenCalledWith(1.2)
  })

  it('update runs without throwing', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('teardown removes every object added during setup', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    const addCount = ctx.add.mock.calls.length
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(addCount)
  })

  it('teardown restores scene fog and background', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    teardown(ctx)
    expect(ctx.scene.fog).toBeNull()
    expect(ctx.scene.background).toBeNull()
  })
})

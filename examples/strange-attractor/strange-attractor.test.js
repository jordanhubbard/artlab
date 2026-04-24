// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeCtx(overrides = {}) {
  return {
    camera: {
      position: new THREE.Vector3(),
      lookAt: vi.fn(),
    },
    renderer: { shadowMap: { enabled: false } },
    controls: { target: { set: vi.fn() } },
    add: vi.fn(),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('strange-attractor', () => {
  let ctx, mod

  beforeEach(async () => {
    ctx = makeCtx()
    mod = await import('./strange-attractor.js')
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

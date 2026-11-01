// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./marble-run.ts')


vi.mock('three', async () => await vi.importActual('three'))

describe('marble-run', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let mod: Demo

  beforeEach(async () => {
    base = makeSpiedContext()
    mod = await import('./marble-run.ts')
  })

  it('setup() does not throw', () => {
    expect(() => (ctx = initialize(mod.setup, base))).not.toThrow()
  })

  it('setup() calls ctx.add at least once', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() calls ctx.setBloom', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates _ramps and _marbles', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._ramps).toBeDefined()
    expect(ctx._model).toBeInstanceOf(Three.Group)
    expect(Array.isArray(ctx._marbles)).toBe(true)
    expect(ctx._spawnTimer).toBeDefined()
  })

  it('ramps alternate slope direction and are offset to catch the prior exit', () => {
    ctx = initialize(mod.setup, base)
    const tilts = ctx._ramps.map(r => Math.sign(r.tilt))
    expect(tilts).toEqual([-1, 1, -1, 1, -1, 1])
    for (let i = 1; i < ctx._ramps.length; i++) {
      const prior = ctx._ramps[i - 1]
      const next = ctx._ramps[i]
      const priorExit = prior.tilt < 0 ? prior.maxX : prior.minX
      expect(priorExit).toBeGreaterThanOrEqual(next.minX)
      expect(priorExit).toBeLessThanOrEqual(next.maxX)
    }
  })

  it('setup() creates _bowl mesh', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._bowl).toBeInstanceOf(Three.Mesh)
  })

  it('setup() creates _lights array', () => {
    ctx = initialize(mod.setup, base)
    expect(ctx._lights).toBeDefined()
    expect(ctx._lights.length).toBeGreaterThanOrEqual(2)
  })


  it('update() runs 3 frames without throwing', () => {
    ctx = initialize(mod.setup, base)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('marbles roll right on ramps that visually descend to the right', () => {
    ctx = initialize(mod.setup, base)
    const ramp = ctx._ramps[0]
    const radius = 0.14
    const x0 = -2.4
    const surfaceY = ramp.cy + (x0 - ramp.cx) * Math.sin(ramp.tilt) + 0.06
    const mesh = new Three.Mesh(new Three.SphereGeometry(radius, 8, 6), new Three.MeshStandardMaterial())
    const marble = {
      pos: new Three.Vector3(x0, surfaceY + radius, 0),
      vel: new Three.Vector3(0, 0, 0),
      radius,
      hue: 0,
      mesh,
      alive: true,
    }
    ctx._marbles.push(marble)

    for (let i = 0; i < 60; i++) {
      ctx.elapsed += 0.016
      mod.update(ctx, 0.016)
    }

    expect(marble.pos.x).toBeGreaterThan(x0)
  })

  it('default seeded marbles traverse the full ramp stack into the catch basin', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    try {
      ctx = initialize(mod.setup, base)
      ctx._spawnTimer = 10
      mod.update(ctx, 0.016)
      expect(ctx._marbles).toHaveLength(1)
      const marble = ctx._marbles[0]

      for (let i = 0; i < 2300; i++) {
        ctx.elapsed += 0.016
        mod.update(ctx, 0.016)
      }

      const bottomRamp = ctx._ramps[ctx._ramps.length - 1]
      expect(marble.alive).toBe(true)
      expect(marble.pos.y).toBeLessThan(bottomRamp.cy)
      expect(marble.pos.y).toBeGreaterThan(bottomRamp.cy - 1.5)
      expect(marble.pos.x).toBeGreaterThan(-5.4)
      expect(marble.pos.x).toBeLessThan(0.6)
    } finally {
      randomSpy.mockRestore()
    }
  })

  it('arrow keys tilt the model and R resets it', () => {
    ctx = initialize(mod.setup, base)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(ctx._model.rotation.z).toBeLessThan(0)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(ctx._model.rotation.x).toBeGreaterThan(0)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }))
    expect(ctx._model.rotation.x).toBe(0)
    expect(ctx._model.rotation.z).toBe(0)
  })


  it('teardown() does not throw', () => {
    ctx = initialize(mod.setup, base)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() calls ctx.remove', () => {
    ctx = initialize(mod.setup, base)
    mod.teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })


})

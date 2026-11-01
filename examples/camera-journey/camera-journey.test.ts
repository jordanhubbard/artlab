// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./camera-journey.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('camera-journey', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    document.body.innerHTML = ''
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./camera-journey.ts'))
  })

  it('setup() completes without throwing', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() creates _rings and _orbiters arrays', () => {
    ctx = initialize(setup, base)
    expect(ctx._cameraPath).toBeDefined()
    expect(ctx._pillarField).toBeInstanceOf(Three.InstancedMesh)
    expect(Array.isArray(ctx._rings)).toBe(true)
    expect(ctx._rings.length).toBeGreaterThanOrEqual(3)
    expect(Array.isArray(ctx._orbiters)).toBe(true)
    expect(ctx._orbiters.length).toBeGreaterThanOrEqual(6)
  })

  it('scripted update moves the camera along the path', () => {
    ctx = initialize(setup, base)
    const start = ctx.camera.position.clone()
    ctx.elapsed = 3
    update(ctx, 0.016)
    expect(ctx.camera.position.distanceTo(start)).toBeGreaterThan(0.1)
    expect(ctx.camera.lookAt).toHaveBeenCalled()
  })

  it('C toggles manual controls and Space rejoins the scripted path', () => {
    ctx = initialize(setup, base)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }))
    expect(ctx._useOrbit).toBe(true)
    expect(ctx.controls.enabled).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(ctx._useOrbit).toBe(false)
    expect(ctx.controls.enabled).toBe(false)
  })

  it('update() runs 3 frames without throwing', () => {
    ctx = initialize(setup, base)
    const frames = [0, 0.016, 0.032]
    for (const elapsed of frames) {
      ctx.elapsed = elapsed
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() runs without throwing and re-enables controls', () => {
    ctx = initialize(setup, base)
    expect(() => teardown(ctx)).not.toThrow()
    expect(ctx.controls.enabled).toBe(true)
    expect(ctx.renderer.domElement.parentElement?.querySelector('#camera-journey-hud')).toBeNull()
  })
})

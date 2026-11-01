// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext, required } from '../../tests/context.ts'
type Demo = typeof import('./color-fields.ts')

vi.mock('three', async () => await vi.importActual('three'))

// ── Mock ctx ──────────────────────────────────────────────────────────────────

const CANVAS_RECT = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0 }

/** Invoke a listener the example registered on the canvas, as the browser would. */
function firePointer(ctx: DemoContext<Demo>, type: string, clientX: number, clientY: number) {
  ctx.renderer.domElement.dispatchEvent(new MouseEvent(type, { clientX, clientY }))
}

/** Advance the simulation without any input. */
function runFrames(ctx: DemoContext<Demo>, update: Demo["update"], count: number, dt = 0.016) {
  for (let i = 0; i < count; i++) {
    ctx.elapsed += dt
    update(ctx, dt)
  }
}

function uniforms(ctx: DemoContext<Demo>) {
  return ctx._field.material.uniforms
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('color-fields — chromatic weather', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./color-fields.ts'))
  })

  it('setup() announces its controls before touching the scene', () => {
    expect(() => (ctx = initialize(setup, base))).not.toThrow()
    expect(ctx.setHelp).toHaveBeenCalledTimes(1)
    const help = required(ctx.setHelp.mock.calls[0][0])
    expect(typeof help).toBe('string')
    expect(help.length).toBeGreaterThan(10)
    expect(help.toLowerCase()).toMatch(/pointer|mouse|drag|click/)
    expect(ctx.setHelp.mock.invocationCallOrder[0])
      .toBeLessThan(ctx.add.mock.invocationCallOrder[0])
  })

  it('builds one continuous field mesh, not a grid of tiles', () => {
    ctx = initialize(setup, base)
    expect('_tiles' in ctx).toBe(false)
    expect(ctx.add).toHaveBeenCalledTimes(1)
    expect(ctx._field).toBeInstanceOf(Three.Mesh)
    expect(ctx.add).toHaveBeenCalledWith(ctx._field)
    expect(ctx._field.material.wireframe).toBe(false)
  })

  it('field geometry is a high-resolution indexed surface', () => {
    ctx = initialize(setup, base)
    const geo = ctx._field.geometry
    expect(geo).toBeInstanceOf(Three.BufferGeometry)
    expect(geo.index).not.toBeNull()
    // One continuous sheet: tens of thousands of vertices in a single draw.
    expect(geo.getAttribute('position').count).toBeGreaterThan(10000)
    expect(required(geo.index).count / 3).toBeGreaterThan(20000)
  })

  it('bakes pigment-like vertex colors that vary across the field', () => {
    ctx = initialize(setup, base)
    const geo = ctx._field.geometry
    const color = geo.getAttribute('color')
    expect(color).toBeDefined()
    expect(color.itemSize).toBe(3)
    expect(color.count).toBe(geo.getAttribute('position').count)

    let min = Infinity
    let max = -Infinity
    let sum = 0
    for (let i = 0; i < color.array.length; i++) {
      const v = color.array[i]
      expect(Number.isFinite(v)).toBe(true)
      if (v < min) min = v
      if (v > max) max = v
      sum += v
    }
    const mean = sum / color.array.length
    // A real pigment spread, not a flat wash.
    expect(min).toBeLessThan(0.25)
    expect(max).toBeGreaterThan(0.6)
    expect(mean).toBeGreaterThan(0.05)
    expect(mean).toBeLessThan(0.8)
  })

  it('drives displacement and color from shader uniforms', () => {
    ctx = initialize(setup, base)
    const mat = ctx._field.material
    expect(mat).toBeInstanceOf(Three.ShaderMaterial)
    expect(mat.fog).toBe(true)
    for (const name of ['uTime', 'uPointer', 'uSwell', 'uRipple', 'uLightDir', 'uAmplitude']) {
      expect(mat.uniforms[name], `missing uniform ${name}`).toBeDefined()
    }
    expect(mat.uniforms.uAmplitude.value).toBeGreaterThan(0)
    expect(mat.uniforms.uPointer.value).toBeInstanceOf(Three.Vector2)
    expect(mat.uniforms.uLightDir.value).toBeInstanceOf(Three.Vector3)
    // Fog uniforms must be present for the material's fog chunks to link.
    expect(mat.uniforms.fogColor).toBeDefined()
    expect(mat.uniforms.fogNear).toBeDefined()
    expect(mat.uniforms.fogFar).toBeDefined()
  })

  it('installs its own atmosphere and restores the scene on teardown', () => {
    const originalFog = base.scene.fog
    const originalBackground = base.scene.background
    ctx = initialize(setup, base)
    expect(ctx.scene.fog).toBeInstanceOf(Three.Fog)
    expect(ctx.scene.background).toBeInstanceOf(Three.Color)
    expect(ctx.scene.background).not.toBe(originalBackground)

    teardown(ctx)
    expect(ctx.scene.fog).toBe(originalFog)
    expect(ctx.scene.background).toBe(originalBackground)
  })

  it('update() moves time, light, and fog without input', () => {
    ctx = initialize(setup, base)
    const u = uniforms(ctx)
    const light0 = u.uLightDir.value.clone()
    const fog0 = required(ctx.scene.fog).color.clone()

    runFrames(ctx, update, 400)

    expect(u.uTime.value).toBeCloseTo(ctx.elapsed, 5)
    expect(u.uLightDir.value.distanceTo(light0)).toBeGreaterThan(0.02)
    expect(u.uLightDir.value.length()).toBeCloseTo(1, 5)
    expect(fog0.getHex()).not.toBe(required(ctx.scene.fog).color.getHex())
  })

  it('pointer motion stirs the field and settles back to rest', () => {
    ctx = initialize(setup, base)
    const u = uniforms(ctx)
    expect(u.uSwell.value).toBe(0)

    firePointer(ctx, 'pointermove', 400, 420)
    update(ctx, 0.016)
    const stirred = u.uSwell.value
    expect(stirred).toBeGreaterThan(0)
    expect(u.uPointer.value.length()).toBeGreaterThan(0)

    // The disturbance is bounded: it decays back to nothing on its own.
    runFrames(ctx, update, 300)
    expect(u.uSwell.value).toBe(0)
    expect(u.uSwell.value).toBeLessThan(stirred)
  })

  it('a click launches a chromatic front that expands and fades', () => {
    ctx = initialize(setup, base)
    const u = uniforms(ctx)
    expect(u.uRipple.value).toBe(0)

    firePointer(ctx, 'pointermove', 400, 420)
    firePointer(ctx, 'pointerdown', 400, 420)
    update(ctx, 0.016)
    expect(u.uRipple.value).toBeGreaterThan(0)
    expect(u.uRippleOrigin.value).toBeInstanceOf(Three.Vector2)

    const age0 = u.uRippleAge.value
    runFrames(ctx, update, 30)
    expect(u.uRippleAge.value).toBeGreaterThan(age0)

    runFrames(ctx, update, 600)
    expect(u.uRipple.value).toBe(0)
  })

  it('update() does no per-frame geometry work', () => {
    ctx = initialize(setup, base)
    const geo = ctx._field.geometry
    const positions = geo.getAttribute('position')
    if (!(positions instanceof Three.BufferAttribute)) throw new Error('Expected plain position buffer')
    const colors = geo.getAttribute('color')
    if (!(colors instanceof Three.BufferAttribute)) throw new Error('Expected plain color buffer')
    const positionVersion = positions.version
    const colorVersion = colors.version

    firePointer(ctx, 'pointermove', 500, 380)
    firePointer(ctx, 'pointerdown', 500, 380)
    runFrames(ctx, update, 120)

    expect(ctx._field.geometry).toBe(geo)
    expect(geo.getAttribute('position')).toBe(positions)
    expect(geo.getAttribute('color')).toBe(colors)
    expect(positions.version).toBe(positionVersion)
    expect(colors.version).toBe(colorVersion)
  })

  it('teardown() releases the mesh, its resources, and every listener', () => {
    ctx = initialize(setup, base)
    const field = ctx._field
    const canvas = ctx.renderer.domElement
    const geoDispose = vi.spyOn(field.geometry, 'dispose')
    const matDispose = vi.spyOn(field.material, 'dispose')

    const added = vi.mocked(canvas.addEventListener).mock.calls.map(([type, handler]) => ({ type, handler }))
    expect(added.length).toBeGreaterThan(0)
    expect(added.map(a => a.type)).toContain('pointermove')
    expect(added.map(a => a.type)).toContain('pointerdown')

    expect(() => teardown(ctx)).not.toThrow()

    expect(ctx.remove).toHaveBeenCalledWith(field)
    expect(geoDispose).toHaveBeenCalled()
    expect(matDispose).toHaveBeenCalled()

    const removed = vi.mocked(canvas.removeEventListener).mock.calls.map(([type, handler]) => ({ type, handler }))
    expect(removed.length).toBe(added.length)
    for (const { type, handler } of added) {
      expect(removed.some(r => r.type === type && r.handler === handler)).toBe(true)
    }
  })

  it('teardown() is safe to call twice', () => {
    ctx = initialize(setup, base)
    teardown(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

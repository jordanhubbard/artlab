// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// ── Mock ctx ──────────────────────────────────────────────────────────────────

const CANVAS_RECT = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0 }

function makeMockCtx(overrides = {}) {
  const scene = {
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
    fog: null,
    background: new Three.Color(0x000005),
  }
  const camera = new Three.PerspectiveCamera(60, CANVAS_RECT.width / CANVAS_RECT.height, 0.1, 4000)
  const controls = {
    update: vi.fn(),
    enableDamping: true,
    target: new Three.Vector3(),
  }

  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ ...CANVAS_RECT, toJSON: () => CANVAS_RECT })
  vi.spyOn(canvas, 'addEventListener')
  vi.spyOn(canvas, 'removeEventListener')

  const renderer = {
    domElement: canvas,
    setSize: vi.fn(),
    render: vi.fn(),
    shadowMap: { enabled: false },
    toneMapping: 0,
  }

  const ctx = {
    Three,
    scene,
    camera,
    renderer,
    controls,
    labelRenderer: {
      render: vi.fn(),
      setSize: vi.fn(),
      domElement: document.createElement('div'),
    },
    add: vi.fn((obj) => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed: 0,
    ...overrides,
  }
  return ctx
}

/** Invoke a listener the example registered on the canvas, as the browser would. */
function firePointer(ctx, type, clientX, clientY) {
  const entry = ctx.renderer.domElement.addEventListener.mock.calls.find(([t]) => t === type)
  expect(entry, `no listener registered for "${type}"`).toBeTruthy()
  entry[1]({ type, clientX, clientY, pointerType: 'mouse', isPrimary: true })
}

/** Advance the simulation without any input. */
function runFrames(ctx, update, count, dt = 0.016) {
  for (let i = 0; i < count; i++) {
    ctx.elapsed += dt
    update(ctx, dt)
  }
}

function uniforms(ctx) {
  return ctx._field.material.uniforms
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('color-fields — chromatic weather', () => {
  let ctx
  let setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./color-fields.js'))
  })

  it('setup() announces its controls before touching the scene', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.setHelp).toHaveBeenCalledTimes(1)
    const help = ctx.setHelp.mock.calls[0][0]
    expect(typeof help).toBe('string')
    expect(help.length).toBeGreaterThan(10)
    expect(help.toLowerCase()).toMatch(/pointer|mouse|drag|click/)
    expect(ctx.setHelp.mock.invocationCallOrder[0])
      .toBeLessThan(ctx.add.mock.invocationCallOrder[0])
  })

  it('builds one continuous field mesh, not a grid of tiles', () => {
    setup(ctx)
    expect(ctx._tiles).toBeUndefined()
    expect(ctx.add).toHaveBeenCalledTimes(1)
    expect(ctx._field).toBeInstanceOf(Three.Mesh)
    expect(ctx.add).toHaveBeenCalledWith(ctx._field)
    expect(ctx._field.material.wireframe).toBe(false)
  })

  it('field geometry is a high-resolution indexed surface', () => {
    setup(ctx)
    const geo = ctx._field.geometry
    expect(geo).toBeInstanceOf(Three.BufferGeometry)
    expect(geo.index).not.toBeNull()
    // One continuous sheet: tens of thousands of vertices in a single draw.
    expect(geo.getAttribute('position').count).toBeGreaterThan(10000)
    expect(geo.index.count / 3).toBeGreaterThan(20000)
  })

  it('bakes pigment-like vertex colors that vary across the field', () => {
    setup(ctx)
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
    setup(ctx)
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
    const originalFog = ctx.scene.fog
    const originalBackground = ctx.scene.background
    setup(ctx)
    expect(ctx.scene.fog).toBeInstanceOf(Three.Fog)
    expect(ctx.scene.background).toBeInstanceOf(Three.Color)
    expect(ctx.scene.background).not.toBe(originalBackground)

    teardown(ctx)
    expect(ctx.scene.fog).toBe(originalFog)
    expect(ctx.scene.background).toBe(originalBackground)
  })

  it('update() moves time, light, and fog without input', () => {
    setup(ctx)
    const u = uniforms(ctx)
    const light0 = u.uLightDir.value.clone()
    const fog0 = ctx.scene.fog.color.clone()

    runFrames(ctx, update, 400)

    expect(u.uTime.value).toBeCloseTo(ctx.elapsed, 5)
    expect(u.uLightDir.value.distanceTo(light0)).toBeGreaterThan(0.02)
    expect(u.uLightDir.value.length()).toBeCloseTo(1, 5)
    expect(fog0.getHex()).not.toBe(ctx.scene.fog.color.getHex())
  })

  it('pointer motion stirs the field and settles back to rest', () => {
    setup(ctx)
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
    setup(ctx)
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
    setup(ctx)
    const geo = ctx._field.geometry
    const positions = geo.getAttribute('position')
    const colors = geo.getAttribute('color')
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
    setup(ctx)
    const field = ctx._field
    const canvas = ctx.renderer.domElement
    const geoDispose = vi.spyOn(field.geometry, 'dispose')
    const matDispose = vi.spyOn(field.material, 'dispose')

    const added = canvas.addEventListener.mock.calls.map(([type, handler]) => ({ type, handler }))
    expect(added.length).toBeGreaterThan(0)
    expect(added.map(a => a.type)).toContain('pointermove')
    expect(added.map(a => a.type)).toContain('pointerdown')

    expect(() => teardown(ctx)).not.toThrow()

    expect(ctx.remove).toHaveBeenCalledWith(field)
    expect(geoDispose).toHaveBeenCalled()
    expect(matDispose).toHaveBeenCalled()

    const removed = canvas.removeEventListener.mock.calls.map(([type, handler]) => ({ type, handler }))
    expect(removed.length).toBe(added.length)
    for (const { type, handler } of added) {
      expect(removed.some(r => r.type === type && r.handler === handler)).toBe(true)
    }
  })

  it('teardown() is safe to call twice', () => {
    setup(ctx)
    teardown(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

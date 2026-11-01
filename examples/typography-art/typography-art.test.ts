// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { canvas2D, initialize, makeSpiedContext, mockCanvas2D, required } from '../../tests/context.ts'
type Demo = typeof import('./typography-art.ts')

vi.mock('three', async () => await vi.importActual('three'))

// ── Canvas 2D context mock ────────────────────────────────────────────────────
// jsdom does not implement canvas.getContext('2d') without the 'canvas' package.
// The dawn sky gradient is painted on a canvas, so return a minimal stub.

function makeCanvas2DContextMock() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    set font(_) {},
    set textAlign(_) {},
    set textBaseline(_) {},
    set fillStyle(_) {},
    set strokeStyle(_) {},
    set lineWidth(_) {},
    set filter(_) {},
    get font() { return '' },
    get textAlign() { return 'start' },
    get textBaseline() { return 'alphabetic' },
    get fillStyle() { return '#000' },
    get strokeStyle() { return '#000' },
    get lineWidth() { return 1 },
    get filter() { return 'none' },
  }
}

mockCanvas2D(() => {
  return canvas2D(makeCanvas2DContextMock())
})

// ── Mock ctx ──────────────────────────────────────────────────────────────────

const DEFAULT_CAMERA_POSITION = new Three.Vector3(0, 0, 50)

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Every mesh reachable from the scene roots the example added. */
function collectMeshes(ctx: DemoContext<Demo>) {
  const meshes: Three.Mesh[] = []
  for (const root of ctx.scene.children) {
    root.traverse?.((obj) => { if (obj instanceof Three.Mesh) meshes.push(obj) })
  }
  return meshes
}

/**
 * World-space bounding boxes of the solid masses the camera could collide with:
 * anything tall enough to matter, excluding the enclosing ground and sky shells.
 */
const SOLID_MIN_HEIGHT = 1.5
const SOLID_MAX_EXTENT = 100

function collectSolidBoxes(ctx: DemoContext<Demo>) {
  const boxes: Three.Box3[] = []
  const size = new Three.Vector3()
  for (const root of ctx.scene.children) {
    root.updateMatrixWorld?.(true)
    root.traverse?.((obj) => {
      if (!(obj instanceof Three.Mesh)) return
      const box = new Three.Box3().setFromObject(obj)
      box.getSize(size)
      if (size.y < SOLID_MIN_HEIGHT) return
      if (Math.max(size.x, size.y, size.z) > SOLID_MAX_EXTENT) return
      boxes.push(box.expandByScalar(0.5))
    })
  }
  return boxes
}

// A full camera loop is shorter than SAMPLE_COUNT * SAMPLE_STEP seconds.
const SAMPLE_STEP = 0.35
const SAMPLE_COUNT = 400

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('typography-art — Monument', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el)
    vi.spyOn(document, 'getElementById').mockReturnValue(null)

    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./typography-art.ts'))
  })

  it('calls ctx.setHelp() with guidance before touching the scene', () => {
    ctx = initialize(setup, base)

    expect(ctx.setHelp).toHaveBeenCalledTimes(1)
    const [helpText] = ctx.setHelp.mock.calls[0]
    expect(typeof helpText).toBe('string')
    expect(required(helpText).length).toBeGreaterThan(10)
    expect(ctx.setHelp.mock.invocationCallOrder[0])
      .toBeLessThan(ctx.add.mock.invocationCallOrder[0])
  })

  it('builds a monument group of glyph masses standing on the ground', () => {
    ctx = initialize(setup, base)

    expect(required(ctx._monument)).toBeDefined()
    expect(required(ctx._monument).isGroup).toBe(true)
    expect(required(ctx._monument).children.length).toBeGreaterThanOrEqual(6)

    for (const glyph of required(ctx._monument).children) {
      const strokes = glyph.children.filter((child) => child instanceof Three.Mesh)
      expect(strokes.length).toBeGreaterThanOrEqual(3)
      for (const stroke of strokes) {
        expect(stroke.castShadow).toBe(true)
        expect(stroke.receiveShadow).toBe(true)
      }
    }
  })

  it('assembles every glyph from one reusable box stroke geometry', () => {
    ctx = initialize(setup, base)

    const strokeGeometries = new Set()
    required(ctx._monument).traverse((obj) => {
      if (!(obj instanceof Three.Mesh)) return
      expect(obj.geometry.type).toBe('BoxGeometry')
      strokeGeometries.add(obj.geometry.uuid)
    })

    expect(strokeGeometries.size).toBe(1)
  })

  it('keeps the monument bounded, centred and resting on the ground', () => {
    ctx = initialize(setup, base)

    required(ctx._monument).updateMatrixWorld(true)
    const bounds = new Three.Box3().setFromObject(required(ctx._monument))
    const size = bounds.getSize(new Three.Vector3())
    const center = bounds.getCenter(new Three.Vector3())

    expect(size.x).toBeGreaterThan(60)
    expect(size.x).toBeLessThan(200)
    expect(size.y).toBeGreaterThan(8)
    expect(size.y).toBeLessThan(30)
    expect(size.z).toBeLessThan(12)
    expect(bounds.min.y).toBeGreaterThan(-0.5)
    expect(Math.abs(center.x)).toBeLessThan(1)
  })

  it('stages a lit dawn environment instead of a black void', () => {
    ctx = initialize(setup, base)

    expect(required(ctx._ground)).toBeDefined()
    expect(required(ctx._ground).receiveShadow).toBe(true)
    expect(required(ctx._ground).rotation.x).toBeCloseTo(-Math.PI / 2)

    expect(required(ctx._sky)).toBeDefined()
    const skyMaterial = required(ctx._sky).material
    if (!(skyMaterial instanceof Three.MeshBasicMaterial)) throw new Error('Expected textured sky material')
    expect(skyMaterial.map).toBeDefined()

    expect(ctx.scene.fog).not.toBeNull()

    const lights = ctx.scene.children.filter((obj) => obj instanceof Three.Light)
    expect(lights.length).toBeGreaterThanOrEqual(2)
    const sun = required(lights.find((light): light is Three.DirectionalLight => light instanceof Three.DirectionalLight))
    expect(sun).toBeDefined()
    expect(sun.castShadow).toBe(true)
    expect(sun.position.y).toBeGreaterThan(0)
  })

  it('surrounds the word with atmospheric pillars', () => {
    ctx = initialize(setup, base)

    expect(required(ctx._pillars)).toBeDefined()
    const pillars = required(ctx._pillars).children.filter((child) => child instanceof Three.Mesh)
    expect(pillars.length).toBeGreaterThanOrEqual(12)
    for (const pillar of pillars) {
      expect(pillar.castShadow).toBe(true)
    }
  })

  it('opens on a reading view where the whole word is legible', () => {
    ctx = initialize(setup, base)

    expect(ctx.camera.position.equals(DEFAULT_CAMERA_POSITION)).toBe(false)
    expect(ctx.camera.lookAt).toHaveBeenCalled()

    required(ctx._monument).updateMatrixWorld(true)
    const bounds = new Three.Box3().setFromObject(required(ctx._monument))

    // High above the glyph tops, far enough back to frame all of them, and
    // aimed at the middle of the word rather than off into empty ground.
    expect(ctx.camera.position.y).toBeGreaterThan(bounds.max.y * 2)
    const distance = bounds.distanceToPoint(ctx.camera.position)
    expect(distance).toBeGreaterThan(80)
    expect(distance).toBeLessThan(260)

    const calls: readonly (readonly unknown[])[] = vi.mocked(ctx.camera.lookAt).mock.calls
    const [target] = required(calls.at(-1))
    if (!(target instanceof Three.Vector3)) throw new Error('Expected vector camera target')
    expect(Math.abs(target.x)).toBeLessThan(4)
    expect(Math.abs(target.z)).toBeLessThan(4)
  })

  it('drifts the camera between the glyph masses without passing through stone', () => {
    ctx = initialize(setup, base)

    const solids = collectSolidBoxes(ctx)
    expect(solids.length).toBeGreaterThan(10)

    let crossedThePlaza = false
    let walkedAtEyeHeight = false
    let roseAboveTheWord = false
    const previous = ctx.camera.position.clone()
    let moved = false

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      ctx.elapsed = i * SAMPLE_STEP
      update(ctx, SAMPLE_STEP)

      const p = ctx.camera.position
      expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true)
      expect(p.y).toBeGreaterThan(2)
      expect(p.y).toBeLessThan(90)
      expect(solids.some((box) => box.containsPoint(p))).toBe(false)

      if (Math.abs(p.z) < 6 && Math.abs(p.x) < 10) crossedThePlaza = true
      if (p.y < 12) walkedAtEyeHeight = true
      if (p.y > 40) roseAboveTheWord = true
      if (!moved && p.distanceTo(previous) > 1) moved = true
    }

    expect(moved).toBe(true)
    expect(crossedThePlaza).toBe(true)
    expect(walkedAtEyeHeight).toBe(true)
    expect(roseAboveTheWord).toBe(true)
  })

  it('adds no scene objects and allocates no geometry while updating', () => {
    ctx = initialize(setup, base)

    const childCount = ctx.scene.children.length
    const meshCount = collectMeshes(ctx).length
    const addCalls = ctx.add.mock.calls.length

    for (let i = 0; i < 5; i++) {
      ctx.elapsed = i * 0.5
      expect(() => update(ctx, 0.016)).not.toThrow()
    }

    expect(ctx.scene.children.length).toBe(childCount)
    expect(collectMeshes(ctx).length).toBe(meshCount)
    expect(ctx.add.mock.calls.length).toBe(addCalls)
  })

  it('teardown() disposes every resource and restores the scene', () => {
    ctx = initialize(setup, base)

    const roots = [...ctx.scene.children]
    const disposables = new Set<Three.BufferGeometry | Three.Material | Three.Texture>()
    for (const mesh of collectMeshes(ctx)) {
      disposables.add(mesh.geometry)
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        disposables.add(material)
        if (material instanceof Three.MeshBasicMaterial && material.map) disposables.add(material.map)
      }
    }
    expect(disposables.size).toBeGreaterThan(3)

    const spies = [...disposables].map((resource) => vi.spyOn(resource, 'dispose'))

    teardown(ctx)

    for (const spy of spies) expect(spy).toHaveBeenCalled()
    for (const root of roots) expect(ctx.remove).toHaveBeenCalledWith(root)
    expect(ctx.scene.fog).toBeNull()
    expect(ctx.controls.enabled).toBe(true)
  })
})

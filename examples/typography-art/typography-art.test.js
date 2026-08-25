// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

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

HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
  if (type === '2d') return makeCanvas2DContextMock()
  return null
})

// ── Mock ctx ──────────────────────────────────────────────────────────────────

const DEFAULT_CAMERA_POSITION = new Three.Vector3(0, 0, 50)

function makeMockCtx(overrides = {}) {
  const scene = {
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
    fog: null,
    background: null,
  }
  const camera = {
    position: DEFAULT_CAMERA_POSITION.clone(),
    up: new Three.Vector3(0, 1, 0),
    lookAt: vi.fn(),
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
    fov: 60,
  }
  const controls = {
    update: vi.fn(),
    enabled: true,
    enableDamping: true,
    target: new Three.Vector3(),
  }
  const renderer = {
    domElement: document.createElement('canvas'),
    setSize: vi.fn(),
    render: vi.fn(),
    shadowMap: { enabled: true },
    toneMapping: 0,
  }

  // The IDE ctx exposes these stdlib shorthands; keep them so the mock stays
  // faithful to the real context even though Monument imports Three directly.
  function plane(w = 1, h = 1) {
    return new Three.PlaneGeometry(w, h)
  }
  function mesh(geometry, options = {}) {
    const { color = 0xffffff, roughness = 0.7, metalness = 0.0 } = options
    return new Three.Mesh(geometry, new Three.MeshStandardMaterial({ color, roughness, metalness }))
  }
  function ambient(color = 0x404040, intensity = 1) {
    return new Three.AmbientLight(color, intensity)
  }

  const ctx = {
    Three,
    scene,
    camera,
    renderer,
    controls,
    plane,
    mesh,
    ambient,
    labelRenderer: {
      render: vi.fn(),
      setSize: vi.fn(),
      domElement: document.createElement('div'),
    },
    add: vi.fn((obj) => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
  return ctx
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Every mesh reachable from the scene roots the example added. */
function collectMeshes(ctx) {
  const meshes = []
  for (const root of ctx.scene.children) {
    root.traverse?.((obj) => { if (obj.isMesh) meshes.push(obj) })
  }
  return meshes
}

/**
 * World-space bounding boxes of the solid masses the camera could collide with:
 * anything tall enough to matter, excluding the enclosing ground and sky shells.
 */
const SOLID_MIN_HEIGHT = 1.5
const SOLID_MAX_EXTENT = 100

function collectSolidBoxes(ctx) {
  const boxes = []
  const size = new Three.Vector3()
  for (const root of ctx.scene.children) {
    root.updateMatrixWorld?.(true)
    root.traverse?.((obj) => {
      if (!obj.isMesh) return
      const box = new Three.Box3().setFromObject(obj)
      box.getSize(size)
      if (size.y < SOLID_MIN_HEIGHT) return
      if (Math.max(size.x, size.y, size.z) > SOLID_MAX_EXTENT) return
      boxes.push(box.expandByScalar(0.5))
    })
  }
  return boxes
}

// A full camera loop is longer than SAMPLE_COUNT * SAMPLE_STEP seconds.
const SAMPLE_STEP = 0.75
const SAMPLE_COUNT = 240

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('typography-art — Monument', () => {
  let ctx
  let setup, update, teardown

  beforeEach(async () => {
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el)
    vi.spyOn(document, 'getElementById').mockReturnValue(null)

    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./typography-art.js'))
  })

  it('calls ctx.setHelp() with guidance before touching the scene', () => {
    setup(ctx)

    expect(ctx.setHelp).toHaveBeenCalledTimes(1)
    const [helpText] = ctx.setHelp.mock.calls[0]
    expect(typeof helpText).toBe('string')
    expect(helpText.length).toBeGreaterThan(10)
    expect(ctx.setHelp.mock.invocationCallOrder[0])
      .toBeLessThan(ctx.add.mock.invocationCallOrder[0])
  })

  it('builds a monument group of glyph masses standing on the ground', () => {
    setup(ctx)

    expect(ctx._monument).toBeDefined()
    expect(ctx._monument.isGroup).toBe(true)
    expect(ctx._monument.children.length).toBeGreaterThanOrEqual(6)

    for (const glyph of ctx._monument.children) {
      const strokes = glyph.children.filter((child) => child.isMesh)
      expect(strokes.length).toBeGreaterThanOrEqual(3)
      for (const stroke of strokes) {
        expect(stroke.castShadow).toBe(true)
        expect(stroke.receiveShadow).toBe(true)
      }
    }
  })

  it('assembles every glyph from one reusable box stroke geometry', () => {
    setup(ctx)

    const strokeGeometries = new Set()
    ctx._monument.traverse((obj) => {
      if (!obj.isMesh) return
      expect(obj.geometry.type).toBe('BoxGeometry')
      strokeGeometries.add(obj.geometry.uuid)
    })

    expect(strokeGeometries.size).toBe(1)
  })

  it('keeps the monument bounded, centred and resting on the ground', () => {
    setup(ctx)

    ctx._monument.updateMatrixWorld(true)
    const bounds = new Three.Box3().setFromObject(ctx._monument)
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
    setup(ctx)

    expect(ctx._ground).toBeDefined()
    expect(ctx._ground.receiveShadow).toBe(true)
    expect(ctx._ground.rotation.x).toBeCloseTo(-Math.PI / 2)

    expect(ctx._sky).toBeDefined()
    expect(ctx._sky.material.map).toBeDefined()

    expect(ctx.scene.fog).not.toBeNull()

    const lights = ctx.scene.children.filter((obj) => obj.isLight)
    expect(lights.length).toBeGreaterThanOrEqual(2)
    const sun = lights.find((light) => light.isDirectionalLight)
    expect(sun).toBeDefined()
    expect(sun.castShadow).toBe(true)
    expect(sun.position.y).toBeGreaterThan(0)
  })

  it('surrounds the word with atmospheric pillars', () => {
    setup(ctx)

    expect(ctx._pillars).toBeDefined()
    const pillars = ctx._pillars.children.filter((child) => child.isMesh)
    expect(pillars.length).toBeGreaterThanOrEqual(12)
    for (const pillar of pillars) {
      expect(pillar.castShadow).toBe(true)
    }
  })

  it('composes a first frame before update() ever runs', () => {
    setup(ctx)

    expect(ctx.camera.position.equals(DEFAULT_CAMERA_POSITION)).toBe(false)
    expect(ctx.camera.position.y).toBeGreaterThan(2)
    expect(ctx.camera.lookAt).toHaveBeenCalled()

    // The word must be somewhere in front of the opening camera.
    ctx._monument.updateMatrixWorld(true)
    const bounds = new Three.Box3().setFromObject(ctx._monument)
    const distance = bounds.distanceToPoint(ctx.camera.position)
    expect(distance).toBeGreaterThan(1)
    expect(distance).toBeLessThan(120)
  })

  it('drifts the camera between the glyph masses without passing through stone', () => {
    setup(ctx)

    const solids = collectSolidBoxes(ctx)
    expect(solids.length).toBeGreaterThan(10)

    let passedThroughWord = false
    let sweptWide = false
    const previous = ctx.camera.position.clone()
    let moved = false

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      ctx.elapsed = i * SAMPLE_STEP
      update(ctx, SAMPLE_STEP)

      const p = ctx.camera.position
      expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true)
      expect(p.y).toBeGreaterThan(2)
      expect(p.y).toBeLessThan(20)
      expect(solids.some((box) => box.containsPoint(p))).toBe(false)

      if (Math.abs(p.z) < 6 && Math.abs(p.x) < 10) passedThroughWord = true
      if (Math.abs(p.z) > 20) sweptWide = true
      if (!moved && p.distanceTo(previous) > 1) moved = true
    }

    expect(moved).toBe(true)
    expect(passedThroughWord).toBe(true)
    expect(sweptWide).toBe(true)
  })

  it('adds no scene objects and allocates no geometry while updating', () => {
    setup(ctx)

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
    setup(ctx)

    const roots = [...ctx.scene.children]
    const disposables = new Set()
    for (const mesh of collectMeshes(ctx)) {
      disposables.add(mesh.geometry)
      disposables.add(mesh.material)
      if (mesh.material.map) disposables.add(mesh.material.map)
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

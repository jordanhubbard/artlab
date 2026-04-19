// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// ── Canvas 2D context mock ────────────────────────────────────────────────────
// jsdom does not implement canvas.getContext('2d') without the 'canvas' package.
// Return a minimal stub so typography-art's setup/update don't throw.

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

// Patch HTMLCanvasElement.prototype.getContext before any test runs
HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
  if (type === '2d') return makeCanvas2DContextMock()
  return null
})

// ── Mock ctx ──────────────────────────────────────────────────────────────────

function makeMockCtx(overrides = {}) {
  const scene = {
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
  }
  const camera = {
    position: new Three.Vector3(0, 0, 50),
    lookAt: vi.fn(),
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
    fov: 60,
  }
  const controls = {
    update: vi.fn(),
    enableDamping: true,
    target: new Three.Vector3(),
  }
  const renderer = {
    domElement: document.createElement('canvas'),
    setSize: vi.fn(),
    render: vi.fn(),
    shadowMap: { enabled: false },
    toneMapping: 0,
  }

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
    labelRenderer: {
      render: vi.fn(),
      setSize: vi.fn(),
      domElement: document.createElement('div'),
    },
    add: vi.fn((obj) => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    plane,
    mesh,
    ambient,
    ...overrides,
  }
  return ctx
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('typography-art', () => {
  let ctx
  let setup, update

  beforeEach(async () => {
    // Mock document.body.appendChild to avoid JSDOM side effects from canvas injection
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el)
    vi.spyOn(document, 'getElementById').mockReturnValue(null)

    ctx = makeMockCtx()
    ;({ setup, update } = await import('./typography-art.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() initialises canvas context and texture', () => {
    setup(ctx)
    expect(ctx._canvas).toBeDefined()
    expect(ctx._canvasCtx).toBeDefined()
    expect(ctx._texture).toBeDefined()
  })

  it('update() runs 3 frames without throwing', () => {
    setup(ctx)
    const frames = [0, 0.016, 0.032]
    for (const elapsed of frames) {
      ctx.elapsed = elapsed
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('update() advances the quote index after QUOTE_INTERVAL elapsed time', () => {
    setup(ctx)
    const initialIdx = ctx._quoteIdx
    // Jump past the 4-second quote interval
    ctx.elapsed = 5.0
    update(ctx, 0.016)
    expect(ctx._quoteIdx).not.toBe(initialIdx)
  })
})

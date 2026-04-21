// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// Polyfill ImageData for jsdom
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(sw, sh) {
      this.width = sw
      this.height = sh
      this.data = new Uint8ClampedArray(sw * sh * 4)
    }
  }
}

// Fake 2D context with ImageData support
function makeFake2DCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    clearRect: vi.fn(),
    putImageData: vi.fn(),
    createImageData(w, h) { return new ImageData(w, h) },
    getImageData(x, y, w, h) {
      const img = new ImageData(w, h)
      // Fill with a gradient-like pattern for testing
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4
          img.data[idx] = Math.floor((px / w) * 255)
          img.data[idx + 1] = Math.floor((py / h) * 255)
          img.data[idx + 2] = 128
          img.data[idx + 3] = 255
        }
      }
      return img
    },
  }
}

const fake2DCtx = makeFake2DCtx()

const _origGetContext = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function (type, ...args) {
  if (type === '2d') return fake2DCtx
  return _origGetContext.call(this, type, ...args)
}

function makeMockCtx(overrides = {}) {
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new THREE.Vector3(0, 0, 10),
    lookAt: vi.fn(),
    fov: 60, aspect: 1, updateProjectionMatrix: vi.fn(),
  }
  return {
    THREE, scene, camera,
    renderer: { domElement: document.createElement('canvas'), setSize: vi.fn(), render: vi.fn() },
    controls: { update: vi.fn(), target: new THREE.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('pixel-sort utilities', () => {
  let mod

  beforeEach(async () => {
    vi.clearAllMocks()
    mod = await import('./pixel-sort.js')
  })

  // ── pixelBrightness ─────────────────────────────────────────────

  it('pixelBrightness returns 0 for black', () => {
    expect(mod.pixelBrightness(0, 0, 0)).toBeCloseTo(0)
  })

  it('pixelBrightness returns 1 for white', () => {
    expect(mod.pixelBrightness(255, 255, 255)).toBeCloseTo(1)
  })

  it('pixelBrightness returns correct value for pure red', () => {
    expect(mod.pixelBrightness(255, 0, 0)).toBeCloseTo(0.299)
  })

  it('pixelBrightness returns correct value for pure green', () => {
    expect(mod.pixelBrightness(0, 255, 0)).toBeCloseTo(0.587)
  })

  it('pixelBrightness returns correct value for pure blue', () => {
    expect(mod.pixelBrightness(0, 0, 255)).toBeCloseTo(0.114)
  })

  it('pixelBrightness handles mid-gray', () => {
    expect(mod.pixelBrightness(128, 128, 128)).toBeCloseTo(128 / 255, 2)
  })

  // ── findSpans ───────────────────────────────────────────────────

  it('findSpans returns empty for all-black row', () => {
    const data = new Uint8ClampedArray(4 * 8) // 8 black pixels
    const spans = mod.findSpans(data, 0, 8, 4, 0.3, 0.8)
    expect(spans).toEqual([])
  })

  it('findSpans finds a contiguous span of mid-brightness pixels', () => {
    // 6 pixels: black, mid, mid, mid, black, black
    const data = new Uint8ClampedArray(4 * 6)
    for (let i = 1; i <= 3; i++) {
      const idx = i * 4
      data[idx] = 128; data[idx + 1] = 128; data[idx + 2] = 128; data[idx + 3] = 255
    }
    const spans = mod.findSpans(data, 0, 6, 4, 0.3, 0.8)
    expect(spans).toEqual([[1, 4]])
  })

  it('findSpans finds multiple separate spans', () => {
    // 8 pixels: mid, mid, black, black, mid, mid, mid, black
    const data = new Uint8ClampedArray(4 * 8)
    const midIndices = [0, 1, 4, 5, 6]
    for (const i of midIndices) {
      const idx = i * 4
      data[idx] = 128; data[idx + 1] = 128; data[idx + 2] = 128; data[idx + 3] = 255
    }
    const spans = mod.findSpans(data, 0, 8, 4, 0.3, 0.8)
    expect(spans).toEqual([[0, 2], [4, 7]])
  })

  it('findSpans works with column stride', () => {
    // Simulate a 4-wide image, 4 rows tall, reading column 0
    const w = 4, h = 4
    const data = new Uint8ClampedArray(4 * w * h)
    // Set column 0, rows 1-2 to mid-brightness
    for (const row of [1, 2]) {
      const idx = (row * w + 0) * 4
      data[idx] = 128; data[idx + 1] = 128; data[idx + 2] = 128; data[idx + 3] = 255
    }
    const spans = mod.findSpans(data, 0, h, w * 4, 0.3, 0.8)
    expect(spans).toEqual([[1, 3]])
  })

  it('findSpans span extends to end when last pixel qualifies', () => {
    const data = new Uint8ClampedArray(4 * 4)
    // All 4 pixels mid-brightness
    for (let i = 0; i < 4; i++) {
      const idx = i * 4
      data[idx] = 128; data[idx + 1] = 128; data[idx + 2] = 128; data[idx + 3] = 255
    }
    const spans = mod.findSpans(data, 0, 4, 4, 0.3, 0.8)
    expect(spans).toEqual([[0, 4]])
  })

  // ── sortSpan ────────────────────────────────────────────────────

  it('sortSpan sorts pixels by brightness ascending', () => {
    // 4 pixels with different brightness values
    const data = new Uint8ClampedArray([
      200, 200, 200, 255,  // bright
      50, 50, 50, 255,     // dark
      150, 150, 150, 255,  // medium
      100, 100, 100, 255,  // dim
    ])
    mod.sortSpan(data, 0, 4, 0, 4, 'brightness')
    // After sort: dark, dim, medium, bright
    expect(data[0]).toBe(50)
    expect(data[4]).toBe(100)
    expect(data[8]).toBe(150)
    expect(data[12]).toBe(200)
  })

  it('sortSpan with hue mode does not throw', () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
    ])
    expect(() => mod.sortSpan(data, 0, 4, 0, 3, 'hue')).not.toThrow()
  })

  it('sortSpan with saturation mode does not throw', () => {
    const data = new Uint8ClampedArray([
      255, 128, 0, 255,
      128, 128, 128, 255,
      0, 255, 0, 255,
    ])
    expect(() => mod.sortSpan(data, 0, 4, 0, 3, 'saturation')).not.toThrow()
  })

  it('sortSpan preserves alpha', () => {
    const data = new Uint8ClampedArray([
      200, 200, 200, 100,
      50, 50, 50, 200,
    ])
    mod.sortSpan(data, 0, 4, 0, 2, 'brightness')
    // dark pixel first (alpha=200), bright pixel second (alpha=100)
    expect(data[3]).toBe(200)
    expect(data[7]).toBe(100)
  })

  it('sortSpan handles single-pixel span as no-op', () => {
    const data = new Uint8ClampedArray([128, 128, 128, 255])
    mod.sortSpan(data, 0, 4, 0, 1, 'brightness')
    expect(data[0]).toBe(128)
  })
})

describe('pixel-sort setup/update/teardown', () => {
  let mod, ctx

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./pixel-sort.js')
  })

  it('setup() does not throw', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
  })

  it('setup() creates _ps state object', () => {
    mod.setup(ctx)
    expect(ctx._ps).toBeDefined()
    expect(ctx._ps.horizontal).toBe(true)
    expect(ctx._ps.sortModeIdx).toBe(0)
  })

  it('setup() adds a plane via ctx.add', () => {
    mod.setup(ctx)
    expect(ctx.add).toHaveBeenCalledTimes(1)
    const addedObj = ctx.add.mock.calls[0][0]
    expect(addedObj).toBeInstanceOf(THREE.Mesh)
  })

  it('setup() creates a CanvasTexture', () => {
    mod.setup(ctx)
    expect(ctx._ps.texture).toBeInstanceOf(THREE.CanvasTexture)
  })

  it('setup() calls setBloom', () => {
    mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.3)
  })

  it('update() runs without throwing', () => {
    mod.setup(ctx)
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('update() marks texture for update (version increments)', () => {
    mod.setup(ctx)
    const vBefore = ctx._ps.texture.version
    mod.update(ctx, 0.016)
    expect(ctx._ps.texture.version).toBeGreaterThan(vBefore)
  })

  it('update() runs multiple frames', () => {
    mod.setup(ctx)
    expect(() => {
      for (let i = 0; i < 5; i++) {
        ctx.elapsed = i * 0.016
        mod.update(ctx, 0.016)
      }
    }).not.toThrow()
  })

  it('teardown() does not throw', () => {
    mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() calls ctx.remove', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._ps.plane)
  })
})

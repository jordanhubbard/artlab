// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// A dusk-like source buffer: vertical light falloff plus horizontal ripple so
// that threshold spans exist and sorting visibly reorders pixels.
function syntheticSource(width, height) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const vertical = 0.18 + 0.55 * (y / height)
      const ripple = 0.22 * Math.sin(x * 0.31 + y * 0.17) + 0.1 * Math.cos(x * 0.07)
      const lum = Math.min(1, Math.max(0, vertical + ripple))
      data[i]     = Math.round(255 * Math.min(1, lum * 1.15))
      data[i + 1] = Math.round(255 * lum * 0.72)
      data[i + 2] = Math.round(255 * Math.min(1, 0.25 + lum * 0.6))
      data[i + 3] = 255
    }
  }
  return data
}

const gradientStub = () => ({ addColorStop: vi.fn() })

const fake2DCtx = {
  fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt',
  lineJoin: 'miter', globalAlpha: 1, filter: 'none',
  save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
  beginPath: vi.fn(), closePath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(), bezierCurveTo: vi.fn(), rect: vi.fn(),
  arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
  fillRect: vi.fn(), clearRect: vi.fn(),
  createLinearGradient: vi.fn(gradientStub),
  createRadialGradient: vi.fn(gradientStub),
  createImageData: vi.fn((w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) })),
  getImageData: vi.fn((x, y, w, h) => ({ width: w, height: h, data: syntheticSource(w, h) })),
  putImageData: vi.fn(),
}

const origGetContext = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function (type, ...args) {
  if (type === '2d') return fake2DCtx
  return origGetContext.call(this, type, ...args)
}

function makeMockCtx(overrides = {}) {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new Three.Vector3(0, 0, 6), lookAt: vi.fn(),
    fov: 60, aspect: 1, updateProjectionMatrix: vi.fn(),
  }
  return {
    Three, scene, camera,
    renderer: { domElement: canvas, shadowMap: { enabled: false }, setSize: vi.fn(), render: vi.fn() },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

function countChangedPixels(current, source) {
  let changed = 0
  for (let i = 0; i < source.length; i += 4) {
    if (current[i] !== source[i] || current[i + 1] !== source[i + 1] || current[i + 2] !== source[i + 2]) {
      changed++
    }
  }
  return changed
}

describe('pixel-sort — Memory Corruption', () => {
  let ctx, mod

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./pixel-sort.js')
  })

  it('setup() calls ctx.setHelp before it touches the scene', () => {
    mod.setup(ctx)
    expect(ctx.setHelp).toHaveBeenCalledTimes(1)
    const helpOrder = ctx.setHelp.mock.invocationCallOrder[0]
    const addOrder = ctx.add.mock.invocationCallOrder[0]
    expect(helpOrder).toBeLessThan(addOrder)
  })

  it('paints the source image from named semantic layers', () => {
    const painted = mod.paintSourceImage(fake2DCtx)
    expect(mod.SOURCE_LAYERS).toEqual(
      expect.arrayContaining(['sky', 'sun', 'ridges', 'water', 'reflection', 'shoreline', 'trees']),
    )
    expect(painted).toEqual(mod.SOURCE_LAYERS)
    expect(fake2DCtx.createLinearGradient).toHaveBeenCalled()
    expect(fake2DCtx.createRadialGradient).toHaveBeenCalled()
    expect(fake2DCtx.arc).toHaveBeenCalled()
    expect(fake2DCtx.lineTo).toHaveBeenCalled()
    expect(fake2DCtx.fill).toHaveBeenCalled()
  })

  it('declares focal anchor regions inside the image', () => {
    expect(mod.ANCHOR_REGIONS.length).toBeGreaterThanOrEqual(2)
    for (const region of mod.ANCHOR_REGIONS) {
      expect(region.name).toBeTruthy()
      expect(region.x).toBeGreaterThanOrEqual(0)
      expect(region.y).toBeGreaterThanOrEqual(0)
      expect(region.x + region.width).toBeLessThanOrEqual(mod.IMAGE_WIDTH)
      expect(region.y + region.height).toBeLessThanOrEqual(mod.IMAGE_HEIGHT)
    }
    const sun = mod.ANCHOR_REGIONS.find(r => r.name === 'sun')
    expect(sun).toBeDefined()
    expect(mod.isAnchored(sun.x + 1, sun.y + 1)).toBe(true)
    expect(mod.isAnchored(0, 0)).toBe(false)
  })

  it('setup() builds a canvas-textured display quad over the pixel buffer', () => {
    mod.setup(ctx)
    expect(ctx._canvas2d).toBeInstanceOf(HTMLCanvasElement)
    expect(ctx._canvas2d.width).toBe(mod.IMAGE_WIDTH)
    expect(ctx._canvas2d.height).toBe(mod.IMAGE_HEIGHT)
    expect(ctx._texture).toBeInstanceOf(Three.CanvasTexture)
    expect(ctx._quad).toBeInstanceOf(Three.Mesh)
    expect(ctx._quad.material.map).toBe(ctx._texture)
    expect(ctx._pixelData.length).toBe(mod.IMAGE_WIDTH * mod.IMAGE_HEIGHT * 4)
    expect(ctx._sourcePixels.length).toBe(ctx._pixelData.length)
    expect(ctx.add).toHaveBeenCalledWith(ctx._quad)
  })

  it('first frame already shows tears without any update', () => {
    mod.setup(ctx)
    expect(fake2DCtx.putImageData).toHaveBeenCalled()
    expect(countChangedPixels(ctx._pixelData, ctx._sourcePixels)).toBeGreaterThan(200)
  })

  it('sortRowSpans() rearranges at most MAX_SORTED_PIXELS_PER_ROW pixels', () => {
    const data = new Uint8ClampedArray(mod.IMAGE_WIDTH * mod.IMAGE_HEIGHT * 4)
    const mid = (mod.SORT_THRESHOLD_LOW + mod.SORT_THRESHOLD_HIGH) / 2
    const row = 6
    for (let x = 0; x < mod.IMAGE_WIDTH; x++) {
      const i = (row * mod.IMAGE_WIDTH + x) * 4
      const value = Math.round(mid * 255) + ((x * 5) % 11) - 5
      data[i] = value
      data[i + 1] = value
      data[i + 2] = value
      data[i + 3] = 255
    }
    const before = new Uint8ClampedArray(data)
    const sorted = mod.sortRowSpans(data, row, mod.SORT_THRESHOLD_LOW, mod.SORT_THRESHOLD_HIGH, false)
    expect(sorted).toBeGreaterThan(0)
    expect(sorted).toBeLessThanOrEqual(mod.MAX_SORTED_PIXELS_PER_ROW)
    expect(countChangedPixels(data, before)).toBeGreaterThan(0)
    expect(countChangedPixels(data, before)).toBeLessThanOrEqual(mod.MAX_SORTED_PIXELS_PER_ROW)
  })

  it('tearBands() drifts bounded bands across the image', () => {
    const first = mod.tearBands(0)
    const later = mod.tearBands(3.5)
    expect(first.length).toBeGreaterThan(0)
    let rows = 0
    for (const band of first) {
      expect(band.y0).toBeGreaterThanOrEqual(0)
      expect(band.y1).toBeLessThanOrEqual(mod.IMAGE_HEIGHT)
      expect(band.y1 - band.y0).toBe(mod.TEAR_BAND_HEIGHT)
      rows += band.y1 - band.y0
    }
    expect(rows).toBeLessThanOrEqual(mod.MAX_CORRUPTED_ROWS)
    expect(later.map(b => b.y0)).not.toEqual(first.map(b => b.y0))
  })

  it('update() keeps per-frame sorting work bounded', () => {
    mod.setup(ctx)
    const versionBefore = ctx._texture.version
    for (let i = 0; i < 24; i++) {
      ctx.elapsed = i * 0.016
      mod.update(ctx, 0.016)
      expect(ctx._dirtyRows.length).toBeLessThanOrEqual(mod.MAX_CORRUPTED_ROWS)
      expect(ctx._sortedPixels).toBeLessThanOrEqual(
        mod.MAX_CORRUPTED_ROWS * mod.MAX_SORTED_PIXELS_PER_ROW,
      )
    }
    expect(ctx._texture.version).toBeGreaterThan(versionBefore)
  })

  it('keeps the image recognizable while corruption travels', () => {
    mod.setup(ctx)
    const total = mod.IMAGE_WIDTH * mod.IMAGE_HEIGHT
    for (let i = 0; i < 60; i++) {
      ctx.elapsed = i * 0.033
      mod.update(ctx, 0.033)
      const changed = countChangedPixels(ctx._pixelData, ctx._sourcePixels)
      expect(changed).toBeGreaterThan(0)
      expect(changed / total).toBeLessThan(0.25)
    }
  })

  it('never corrupts focal anchor regions', () => {
    mod.setup(ctx)
    for (let i = 0; i < 60; i++) {
      ctx.elapsed = i * 0.033
      mod.update(ctx, 0.033)
    }
    for (const region of mod.ANCHOR_REGIONS) {
      for (let y = region.y; y < region.y + region.height; y++) {
        for (let x = region.x; x < region.x + region.width; x++) {
          const i = (y * mod.IMAGE_WIDTH + x) * 4
          expect(ctx._pixelData[i]).toBe(ctx._sourcePixels[i])
          expect(ctx._pixelData[i + 1]).toBe(ctx._sourcePixels[i + 1])
          expect(ctx._pixelData[i + 2]).toBe(ctx._sourcePixels[i + 2])
        }
      }
    }
  })

  it('teardown() removes the quad and disposes GPU resources', () => {
    mod.setup(ctx)
    const quad = ctx._quad
    const geoSpy = vi.spyOn(quad.geometry, 'dispose')
    const matSpy = vi.spyOn(quad.material, 'dispose')
    const texSpy = vi.spyOn(ctx._texture, 'dispose')
    expect(() => mod.teardown(ctx)).not.toThrow()
    expect(ctx.remove).toHaveBeenCalledWith(quad)
    expect(geoSpy).toHaveBeenCalled()
    expect(matSpy).toHaveBeenCalled()
    expect(texSpy).toHaveBeenCalled()
    expect(ctx._pixelData).toBeNull()
    expect(ctx._sourcePixels).toBeNull()
  })
})

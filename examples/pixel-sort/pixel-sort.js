// pixel-sort — "Memory Corruption": a dusk lake painted with Canvas 2D whose
// memory is failing. Drifting horizontal bands are threshold pixel-sorted into
// tears, while the sun, its reflection, and the treeline are held intact so the
// landscape stays legible.
import * as Three from 'three'

export const IMAGE_WIDTH = 256
export const IMAGE_HEIGHT = 256

const TAU = Math.PI * 2
const HORIZON_Y = 146
const SUN_X = 168
const SUN_Y = 122
const SUN_RADIUS = 13
const SUN_GLOW_RADIUS = 54
const SHORE_Y = 206

// Focal regions the corruption is never allowed to touch.
export const ANCHOR_REGIONS = [
  { name: 'sun', x: 148, y: 102, width: 40, height: 40 },
  { name: 'reflection', x: 152, y: 146, width: 32, height: 52 },
  { name: 'treeline', x: 22, y: 156, width: 64, height: 84 },
]

export const SOURCE_LAYERS = [
  'sky', 'clouds', 'sun', 'ridges', 'water', 'reflection', 'shoreline', 'trees', 'birds',
]

// Sorting budget. Every value below caps per-frame work so the frame cost is
// constant regardless of image content.
export const SORT_THRESHOLD_LOW = 0.10
export const SORT_THRESHOLD_HIGH = 0.94
export const TEAR_BAND_HEIGHT = 18
export const MAX_SORTED_PIXELS_PER_ROW = 192
const THRESHOLD_DRIFT = 0.06
const MAX_SPAN = 128
const MIN_SPAN = 4
const GRAIN_AMPLITUDE = 8

const TEAR_TRACKS = [
  { speed:  0.041, phase: 0.13, descending: false, shear:  15 },
  { speed: -0.026, phase: 0.52, descending: true,  shear: -22 },
  { speed:  0.068, phase: 0.81, descending: false, shear:  11 },
]

export const MAX_CORRUPTED_ROWS = TEAR_TRACKS.length * TEAR_BAND_HEIGHT

// Preallocated scratch so no frame allocates.
const spanPixels = new Uint8Array(MAX_SPAN * 4)
const spanKeys = new Uint8Array(MAX_SPAN)
const bucketOffsets = new Uint32Array(256)
const rowPixels = new Uint8Array(IMAGE_WIDTH * 4)

// ---------------------------------------------------------------- source image

const CLOUD_BANDS = [
  { x:  54, y:  38, rx: 62, ry:  7, alpha: 0.30, color: '#4b3b7a' },
  { x: 196, y:  52, rx: 48, ry:  5, alpha: 0.26, color: '#5c3a72' },
  { x: 112, y:  70, rx: 78, ry:  6, alpha: 0.34, color: '#7d3f68' },
  { x: 210, y:  88, rx: 56, ry:  4, alpha: 0.38, color: '#a84d63' },
  { x:  46, y:  99, rx: 70, ry:  5, alpha: 0.42, color: '#c2604f' },
  { x: 150, y: 112, rx: 92, ry:  4, alpha: 0.34, color: '#e08a52' },
  { x:  92, y: 128, rx: 64, ry:  3, alpha: 0.30, color: '#f0a463' },
]

const RIDGES = [
  { base: HORIZON_Y - 1, amplitude: 30, frequency: 0.019, phase: 0.6, color: '#3b2c50' },
  { base: HORIZON_Y,     amplitude: 19, frequency: 0.033, phase: 2.1, color: '#271e3a' },
  { base: HORIZON_Y + 1, amplitude: 10, frequency: 0.051, phase: 4.7, color: '#171226' },
]

const TREES = [
  { x:  36, base: 232, height: 74, width: 24 },
  { x:  70, base: 238, height: 58, width: 20 },
  { x: 112, base: 244, height: 40, width: 15 },
  { x: 214, base: 240, height: 48, width: 17 },
]

function ridgeProfile(x, ridge) {
  const wave =
    Math.sin(x * ridge.frequency + ridge.phase) * 0.6 +
    Math.sin(x * ridge.frequency * 2.3 + ridge.phase * 1.7) * 0.3 +
    Math.sin(x * ridge.frequency * 4.1 + ridge.phase * 0.4) * 0.1
  return ridge.base - ridge.amplitude * (0.45 + 0.55 * wave)
}

function paintSky(g) {
  const sky = g.createLinearGradient(0, 0, 0, HORIZON_Y)
  sky.addColorStop(0, '#080b1f')
  sky.addColorStop(0.42, '#2c2158')
  sky.addColorStop(0.7, '#7a3363')
  sky.addColorStop(0.88, '#c85b4a')
  sky.addColorStop(1, '#f2a75f')
  g.fillStyle = sky
  g.fillRect(0, 0, IMAGE_WIDTH, HORIZON_Y)
}

function paintClouds(g) {
  for (const band of CLOUD_BANDS) {
    g.save()
    g.globalAlpha = band.alpha
    g.fillStyle = band.color
    g.beginPath()
    g.ellipse(band.x, band.y, band.rx, band.ry, 0, 0, TAU)
    g.fill()
    g.restore()
  }
}

function paintSun(g) {
  const glow = g.createRadialGradient(SUN_X, SUN_Y, 1, SUN_X, SUN_Y, SUN_GLOW_RADIUS)
  glow.addColorStop(0, 'rgba(255,238,196,0.92)')
  glow.addColorStop(0.3, 'rgba(255,176,104,0.42)')
  glow.addColorStop(1, 'rgba(255,120,72,0)')
  g.fillStyle = glow
  g.fillRect(SUN_X - SUN_GLOW_RADIUS, SUN_Y - SUN_GLOW_RADIUS, SUN_GLOW_RADIUS * 2, SUN_GLOW_RADIUS * 2)

  g.fillStyle = '#ffe9bb'
  g.beginPath()
  g.arc(SUN_X, SUN_Y, SUN_RADIUS, 0, TAU)
  g.fill()
}

function paintRidges(g) {
  for (const ridge of RIDGES) {
    g.fillStyle = ridge.color
    g.beginPath()
    g.moveTo(0, ridgeProfile(0, ridge))
    for (let x = 2; x <= IMAGE_WIDTH; x += 2) g.lineTo(x, ridgeProfile(x, ridge))
    g.lineTo(IMAGE_WIDTH, HORIZON_Y + 4)
    g.lineTo(0, HORIZON_Y + 4)
    g.closePath()
    g.fill()
  }
}

function paintWater(g) {
  const water = g.createLinearGradient(0, HORIZON_Y, 0, IMAGE_HEIGHT)
  water.addColorStop(0, '#8a4655')
  water.addColorStop(0.22, '#4d2947')
  water.addColorStop(0.6, '#27182f')
  water.addColorStop(1, '#0f0a1a')
  g.fillStyle = water
  g.fillRect(0, HORIZON_Y, IMAGE_WIDTH, IMAGE_HEIGHT - HORIZON_Y)

  // Ripple highlights: the horizontal structure the sorter feeds on.
  g.save()
  for (let y = HORIZON_Y + 2; y < IMAGE_HEIGHT; y += 3) {
    const depth = (y - HORIZON_Y) / (IMAGE_HEIGHT - HORIZON_Y)
    g.globalAlpha = 0.26 * (1 - depth) + 0.05
    g.fillStyle = depth < 0.5 ? '#d98a72' : '#6d4560'
    const stride = 26 + Math.floor(depth * 34)
    const drift = Math.floor(Math.sin(y * 0.37) * 18)
    for (let x = (drift % stride + stride) % stride; x < IMAGE_WIDTH; x += stride) {
      g.fillRect(x, y, 10 + Math.floor(depth * 18), 1)
    }
  }
  g.restore()
}

function paintReflection(g) {
  g.save()
  for (let y = HORIZON_Y; y < IMAGE_HEIGHT; y += 2) {
    const depth = (y - HORIZON_Y) / (IMAGE_HEIGHT - HORIZON_Y)
    const width = 8 + depth * 26
    const wobble = Math.sin(y * 0.55) * 4 + Math.sin(y * 0.19) * 3
    g.globalAlpha = 0.5 * (1 - depth) + 0.06
    g.fillStyle = depth < 0.35 ? '#ffd79a' : '#e0865c'
    g.fillRect(SUN_X - width / 2 + wobble, y, width, 1)
  }
  g.restore()
}

function paintShoreline(g) {
  g.fillStyle = '#0a0713'
  g.beginPath()
  g.moveTo(0, IMAGE_HEIGHT)
  g.lineTo(0, SHORE_Y + 6)
  for (let x = 0; x <= IMAGE_WIDTH; x += 8) {
    const edge = SHORE_Y + Math.sin(x * 0.06) * 5 + Math.sin(x * 0.021) * 7
    g.lineTo(x, edge)
  }
  g.lineTo(IMAGE_WIDTH, IMAGE_HEIGHT)
  g.closePath()
  g.fill()
}

function paintTrees(g) {
  for (const tree of TREES) {
    g.fillStyle = '#080610'
    g.fillRect(tree.x - 1, tree.base - tree.height * 0.2, 3, tree.height * 0.25)

    const tiers = 4
    for (let tier = 0; tier < tiers; tier++) {
      const t = tier / tiers
      const top = tree.base - tree.height * (1 - t * 0.62)
      const spread = tree.width * (0.35 + t * 0.65) * 0.5
      const bottom = top + tree.height * 0.34
      g.beginPath()
      g.moveTo(tree.x, top)
      g.lineTo(tree.x + spread, bottom)
      g.lineTo(tree.x - spread, bottom)
      g.closePath()
      g.fill()
    }
  }
}

function paintBirds(g) {
  g.strokeStyle = 'rgba(16,10,26,0.85)'
  g.lineWidth = 1
  const birds = [{ x: 82, y: 46, s: 4 }, { x: 96, y: 38, s: 3 }, { x: 108, y: 50, s: 5 }]
  for (const bird of birds) {
    g.beginPath()
    g.moveTo(bird.x - bird.s, bird.y)
    g.lineTo(bird.x, bird.y - bird.s * 0.6)
    g.lineTo(bird.x + bird.s, bird.y)
    g.stroke()
  }
}

const LAYER_PAINTERS = {
  sky: paintSky,
  clouds: paintClouds,
  sun: paintSun,
  ridges: paintRidges,
  water: paintWater,
  reflection: paintReflection,
  shoreline: paintShoreline,
  trees: paintTrees,
  birds: paintBirds,
}

// Paints the dusk landscape layer by layer and reports the layers it drew.
export function paintSourceImage(g) {
  for (const layer of SOURCE_LAYERS) LAYER_PAINTERS[layer](g)
  return SOURCE_LAYERS.slice()
}

// Film grain gives the smooth gradients enough per-pixel variation for the
// threshold sort to bite; without it the sorted spans are already ordered.
function applyGrain(pixels) {
  for (let y = 0; y < IMAGE_HEIGHT; y++) {
    for (let x = 0; x < IMAGE_WIDTH; x++) {
      const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
      const noise = ((hash - Math.floor(hash)) * 2 - 1) * GRAIN_AMPLITUDE
      const i = (y * IMAGE_WIDTH + x) * 4
      pixels[i] += noise
      pixels[i + 1] += noise * 0.8
      pixels[i + 2] += noise * 0.9
    }
  }
}

// Stand-in used only where no 2D context exists (jsdom, headless hosts). It
// keeps the same dusk palette and horizontal structure so the sorting pipeline
// still has real luminance spans to work on.
function writeFallbackSource(pixels) {
  for (let y = 0; y < IMAGE_HEIGHT; y++) {
    const sky = y < HORIZON_Y
    const t = sky ? y / HORIZON_Y : (y - HORIZON_Y) / (IMAGE_HEIGHT - HORIZON_Y)
    for (let x = 0; x < IMAGE_WIDTH; x++) {
      const ripple = sky
        ? Math.sin(x * 0.05 + y * 0.02) * 0.05
        : Math.sin(x * 0.21 + y * 0.44) * 0.14
      const sun = Math.max(0, 1 - Math.hypot(x - SUN_X, y - SUN_Y) / SUN_GLOW_RADIUS)
      const warm = (sky ? t : 1 - t * 0.8) + ripple + sun * 0.7
      const i = (y * IMAGE_WIDTH + x) * 4
      pixels[i] = Math.round(255 * Math.min(1, 0.04 + warm * 0.92))
      pixels[i + 1] = Math.round(255 * Math.min(1, 0.05 + warm * 0.55))
      pixels[i + 2] = Math.round(255 * Math.min(1, 0.14 + warm * 0.42))
      pixels[i + 3] = 255
    }
  }
}

// ------------------------------------------------------------------- corruption

export function isAnchored(x, y) {
  for (const region of ANCHOR_REGIONS) {
    if (x >= region.x && x < region.x + region.width &&
        y >= region.y && y < region.y + region.height) return true
  }
  return false
}

// Rec. 601 luminance as a 0–255 sort key.
export function luminanceByte(pixels, index) {
  return (pixels[index] * 77 + pixels[index + 1] * 150 + pixels[index + 2] * 29) >> 8
}

// Stable counting sort of one span, in place, without allocating.
function sortSpan(pixels, rowStart, start, length, descending) {
  bucketOffsets.fill(0)
  for (let k = 0; k < length; k++) {
    const src = (rowStart + start + k) * 4
    const key = luminanceByte(pixels, src)
    spanKeys[k] = key
    bucketOffsets[key]++
    const dst = k * 4
    spanPixels[dst] = pixels[src]
    spanPixels[dst + 1] = pixels[src + 1]
    spanPixels[dst + 2] = pixels[src + 2]
    spanPixels[dst + 3] = pixels[src + 3]
  }

  let running = 0
  if (descending) {
    for (let bucket = 255; bucket >= 0; bucket--) {
      const count = bucketOffsets[bucket]
      bucketOffsets[bucket] = running
      running += count
    }
  } else {
    for (let bucket = 0; bucket < 256; bucket++) {
      const count = bucketOffsets[bucket]
      bucketOffsets[bucket] = running
      running += count
    }
  }

  for (let k = 0; k < length; k++) {
    const target = (rowStart + start + bucketOffsets[spanKeys[k]]++) * 4
    const src = k * 4
    pixels[target] = spanPixels[src]
    pixels[target + 1] = spanPixels[src + 1]
    pixels[target + 2] = spanPixels[src + 2]
    pixels[target + 3] = spanPixels[src + 3]
  }
}

function isSortable(pixels, rowStart, x, y, lowKey, highKey) {
  if (isAnchored(x, y)) return false
  const key = luminanceByte(pixels, (rowStart + x) * 4)
  return key >= lowKey && key <= highKey
}

// Sorts the threshold spans of one row and returns how many pixels moved.
// Never exceeds MAX_SORTED_PIXELS_PER_ROW, so cost per row is bounded.
export function sortRowSpans(pixels, y, low, high, descending = false) {
  const rowStart = y * IMAGE_WIDTH
  const lowKey = Math.round(low * 255)
  const highKey = Math.round(high * 255)
  let sorted = 0
  let x = 0

  while (x < IMAGE_WIDTH && sorted < MAX_SORTED_PIXELS_PER_ROW) {
    if (!isSortable(pixels, rowStart, x, y, lowKey, highKey)) {
      x++
      continue
    }
    const start = x
    const limit = Math.min(MAX_SPAN, MAX_SORTED_PIXELS_PER_ROW - sorted)
    while (x < IMAGE_WIDTH && x - start < limit &&
           isSortable(pixels, rowStart, x, y, lowKey, highKey)) x++

    const length = x - start
    if (length < MIN_SPAN) continue
    sortSpan(pixels, rowStart, start, length, descending)
    sorted += length
  }
  return sorted
}

// Where the tears are this instant: bounded bands drifting at different rates.
export function tearBands(time) {
  const travel = IMAGE_HEIGHT - TEAR_BAND_HEIGHT
  return TEAR_TRACKS.map(track => {
    const phase = (((time * track.speed + track.phase) % 1) + 1) % 1
    const y0 = Math.floor(phase * travel)
    return { y0, y1: y0 + TEAR_BAND_HEIGHT, descending: track.descending, shear: track.shear }
  })
}

function shearRow(pixels, y, offset) {
  if (offset === 0) return
  const rowStart = y * IMAGE_WIDTH * 4
  for (let k = 0; k < IMAGE_WIDTH * 4; k++) rowPixels[k] = pixels[rowStart + k]
  for (let x = 0; x < IMAGE_WIDTH; x++) {
    const src = (((x - offset) % IMAGE_WIDTH) + IMAGE_WIDTH) % IMAGE_WIDTH
    const to = rowStart + x * 4
    const from = src * 4
    pixels[to] = rowPixels[from]
    pixels[to + 1] = rowPixels[from + 1]
    pixels[to + 2] = rowPixels[from + 2]
    pixels[to + 3] = rowPixels[from + 3]
  }
}

// Chromatic fringe: the red channel of a row remembers a slightly different
// address than the other two.
function bleedRedChannel(pixels, y, offset) {
  if (offset === 0) return
  const rowStart = y * IMAGE_WIDTH * 4
  for (let x = 0; x < IMAGE_WIDTH; x++) rowPixels[x * 4] = pixels[rowStart + x * 4]
  for (let x = 0; x < IMAGE_WIDTH; x++) {
    const src = (((x - offset) % IMAGE_WIDTH) + IMAGE_WIDTH) % IMAGE_WIDTH
    pixels[rowStart + x * 4] = rowPixels[src * 4]
  }
}

function copyRow(pixels, source, y) {
  const rowStart = y * IMAGE_WIDTH * 4
  for (let k = 0; k < IMAGE_WIDTH * 4; k++) pixels[rowStart + k] = source[rowStart + k]
}

// Stuck memory: a row re-reads its neighbour, thickening a sorted streak.
function holdRow(pixels, from, to) {
  const src = from * IMAGE_WIDTH * 4
  const dst = to * IMAGE_WIDTH * 4
  for (let k = 0; k < IMAGE_WIDTH * 4; k++) pixels[dst + k] = pixels[src + k]
}

function restoreAnchors(pixels, source, y) {
  for (const region of ANCHOR_REGIONS) {
    if (y < region.y || y >= region.y + region.height) continue
    const from = (y * IMAGE_WIDTH + region.x) * 4
    const to = from + region.width * 4
    for (let k = from; k < to; k++) pixels[k] = source[k]
  }
}

// Heals last frame's tears, then carves this frame's. Work is capped at
// MAX_CORRUPTED_ROWS rows × MAX_SORTED_PIXELS_PER_ROW pixels.
function corruptFrame(ctx) {
  const pixels = ctx._pixelData
  const source = ctx._sourcePixels

  for (let i = 0; i < ctx._dirtyRows.length; i++) copyRow(pixels, source, ctx._dirtyRows[i])
  ctx._dirtyRows.length = 0

  const drift = Math.sin(ctx._time * 0.27) * THRESHOLD_DRIFT
  const low = SORT_THRESHOLD_LOW + drift
  const high = SORT_THRESHOLD_HIGH - drift

  let sorted = 0
  for (const band of tearBands(ctx._time)) {
    for (let y = band.y0; y < band.y1; y++) {
      const local = y - band.y0
      if (local > 0 && local % 5 >= 3) {
        holdRow(pixels, y - 1, y)
      } else {
        const jitter = Math.round(Math.sin(y * 1.7 + band.shear) * 5)
        shearRow(pixels, y, band.shear + jitter)
        sorted += sortRowSpans(pixels, y, low, high, band.descending)
        if (local % 3 === 0) bleedRedChannel(pixels, y, band.shear > 0 ? 4 : -4)
      }
      restoreAnchors(pixels, source, y)
      ctx._dirtyRows.push(y)
      ctx._sortRow = y
    }
  }
  ctx._sortedPixels = sorted
}

function present(ctx) {
  if (ctx._imageData) ctx._ctx2d.putImageData(ctx._imageData, 0, 0)
  ctx._texture.needsUpdate = true
}

// -------------------------------------------------------------------- lifecycle

export function setup(ctx) {
  ctx.setHelp('Memory Corruption — a dusk lake decaying in failing memory. ' +
    'Drifting bands are pixel-sorted into tears while the sun, its reflection, and the treeline stay intact.')

  ctx.camera.position.set(0, 0, 6.4)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(0.32)

  ctx._canvas2d = document.createElement('canvas')
  ctx._canvas2d.width = IMAGE_WIDTH
  ctx._canvas2d.height = IMAGE_HEIGHT
  ctx._ctx2d = ctx._canvas2d.getContext('2d', { willReadFrequently: true })

  if (ctx._ctx2d) {
    paintSourceImage(ctx._ctx2d)
    ctx._imageData = ctx._ctx2d.getImageData(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT)
    ctx._pixelData = ctx._imageData.data
    ctx._texture = new Three.CanvasTexture(ctx._canvas2d)
  } else {
    ctx._imageData = null
    ctx._pixelData = new Uint8ClampedArray(IMAGE_WIDTH * IMAGE_HEIGHT * 4)
    writeFallbackSource(ctx._pixelData)
    ctx._texture = new Three.DataTexture(
      new Uint8Array(ctx._pixelData.buffer), IMAGE_WIDTH, IMAGE_HEIGHT, Three.RGBAFormat,
    )
  }
  ctx._texture.colorSpace = Three.SRGBColorSpace
  applyGrain(ctx._pixelData)
  ctx._sourcePixels = new Uint8ClampedArray(ctx._pixelData)

  // Dark mount behind the image so the frame reads as a plate, not a void.
  ctx._backdrop = new Three.Mesh(
    new Three.PlaneGeometry(6.9, 6.9),
    new Three.MeshBasicMaterial({ color: 0x0c0a14 }),
  )
  ctx._backdrop.position.z = -0.04
  ctx.add(ctx._backdrop)

  ctx._quad = new Three.Mesh(
    new Three.PlaneGeometry(6, 6),
    new Three.MeshBasicMaterial({ map: ctx._texture }),
  )
  ctx.add(ctx._quad)

  ctx._time = 0
  ctx._sortRow = 0
  ctx._sortedPixels = 0
  ctx._dirtyRows = []

  // Corrupt immediately: the first frame is already a torn image.
  corruptFrame(ctx)
  present(ctx)
}

export function update(ctx, dt) {
  ctx._time += Math.min(dt, 0.05)
  corruptFrame(ctx)
  present(ctx)
  ctx._quad.rotation.z = Math.sin(ctx._time * 0.12) * 0.006
}

export function teardown(ctx) {
  ctx.remove(ctx._quad)
  ctx._quad.geometry.dispose()
  ctx._quad.material.dispose()

  ctx.remove(ctx._backdrop)
  ctx._backdrop.geometry.dispose()
  ctx._backdrop.material.dispose()

  ctx._texture.dispose()

  ctx._quad = null
  ctx._backdrop = null
  ctx._texture = null
  ctx._imageData = null
  ctx._pixelData = null
  ctx._sourcePixels = null
  ctx._dirtyRows = null
  ctx._ctx2d = null
  ctx._canvas2d = null
}

// pixel-sort — real-time pixel-sorting glitch art on a procedural texture.
import * as Three from 'three'

const WIDTH = 256
const HEIGHT = 256
const SORT_ROWS_PER_FRAME = 8
const THRESHOLD_LOW = 0.2
const THRESHOLD_HIGH = 0.8

function generateBaseImage(data, time) {
  // Procedural gradient + noise bands
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4

      // Base: diagonal gradient with sine waves
      const nx = x / WIDTH
      const ny = y / HEIGHT
      const v1 = Math.sin(nx * 6 + time * 0.3) * 0.3
      const v2 = Math.cos(ny * 4 + time * 0.2) * 0.3
      const v3 = Math.sin((nx + ny) * 8 + time * 0.5) * 0.2

      const r = Math.max(0, Math.min(1, 0.3 + v1 + nx * 0.4))
      const g = Math.max(0, Math.min(1, 0.2 + v2 + ny * 0.3))
      const b = Math.max(0, Math.min(1, 0.4 + v3 + (1 - nx) * 0.3))

      data[i]     = (r * 255) | 0
      data[i + 1] = (g * 255) | 0
      data[i + 2] = (b * 255) | 0
      data[i + 3] = 255
    }
  }
}

function pixelBrightness(data, i) {
  return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
}

function sortRow(data, y, threshLow, threshHigh) {
  // Find spans of pixels within brightness threshold and sort them
  let x = 0
  while (x < WIDTH) {
    // Find start of a span
    const startI = (y * WIDTH + x) * 4
    const b = pixelBrightness(data, startI)
    if (b < threshLow || b > threshHigh) {
      x++
      continue
    }

    // Find end of span
    const spanStart = x
    while (x < WIDTH) {
      const bi = pixelBrightness(data, (y * WIDTH + x) * 4)
      if (bi < threshLow || bi > threshHigh) break
      x++
    }
    const spanEnd = x

    if (spanEnd - spanStart < 2) continue

    // Extract span pixels
    const pixels = []
    for (let sx = spanStart; sx < spanEnd; sx++) {
      const si = (y * WIDTH + sx) * 4
      pixels.push({
        r: data[si], g: data[si + 1], b: data[si + 2], a: data[si + 3],
        bright: pixelBrightness(data, si),
      })
    }

    // Sort by brightness
    pixels.sort((a, b) => a.bright - b.bright)

    // Write back
    for (let j = 0; j < pixels.length; j++) {
      const si = (y * WIDTH + (spanStart + j)) * 4
      data[si]     = pixels[j].r
      data[si + 1] = pixels[j].g
      data[si + 2] = pixels[j].b
      data[si + 3] = pixels[j].a
    }
  }
}

export function setup(ctx) {
  ctx.camera.position.set(0, 0, 5)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(0.2)

  // Create a DataTexture for our pixel buffer
  ctx._pixelData = new Uint8Array(WIDTH * HEIGHT * 4)
  ctx._texture = new Three.DataTexture(ctx._pixelData, WIDTH, HEIGHT, Three.RGBAFormat)
  ctx._texture.needsUpdate = true

  // Display quad
  const geo = new Three.PlaneGeometry(6, 6)
  const mat = new Three.MeshBasicMaterial({ map: ctx._texture })
  ctx._quad = new Three.Mesh(geo, mat)
  ctx.add(ctx._quad)

  ctx._sortRow = 0
  ctx._time = 0
  ctx._threshPhase = 0

  // Generate initial image
  generateBaseImage(ctx._pixelData, 0)
  ctx._texture.needsUpdate = true

  // Subtle background glow
  const ambient = new Three.AmbientLight(0x222233, 0.5)
  ctx.add(ambient)
  ctx._lights = [ambient]
}

export function update(ctx, dt) {
  const dt_ = Math.min(dt, 0.05)
  ctx._time += dt_
  ctx._threshPhase += dt_ * 0.3

  // Slowly evolve the base image
  if (Math.floor(ctx._time * 2) % 3 === 0) {
    generateBaseImage(ctx._pixelData, ctx._time)
  }

  // Animated thresholds for evolving glitch patterns
  const tLow = THRESHOLD_LOW + Math.sin(ctx._threshPhase) * 0.15
  const tHigh = THRESHOLD_HIGH + Math.cos(ctx._threshPhase * 0.7) * 0.15

  // Sort a batch of rows per frame
  for (let i = 0; i < SORT_ROWS_PER_FRAME; i++) {
    sortRow(ctx._pixelData, ctx._sortRow, tLow, tHigh)
    ctx._sortRow = (ctx._sortRow + 1) % HEIGHT
  }

  ctx._texture.needsUpdate = true

  // Gentle sway
  ctx._quad.rotation.z = Math.sin(ctx._time * 0.1) * 0.02
}

export function teardown(ctx) {
  ctx.remove(ctx._quad)
  ctx._quad.geometry.dispose()
  ctx._quad.material.dispose()
  ctx._texture.dispose()
  for (const l of ctx._lights) ctx.remove(l)
}

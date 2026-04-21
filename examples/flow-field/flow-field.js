// flow-field — Perlin noise flow field with thousands of particles tracing curl paths.
import * as Three from 'three'
import { noise2 } from '../../src/stdlib/math.js'

const PARTICLE_COUNT = 4000
const FIELD_SCALE    = 0.012     // noise sampling scale
const SPEED          = 1.5
const FADE_RATE      = 0.003
const TIME_SCALE     = 0.04     // slow noise evolution
const BOUNDS_X       = 50
const BOUNDS_Y       = 30
const SPAWN_ALPHA    = 0.8

function randomPosition() {
  return [
    (Math.random() - 0.5) * BOUNDS_X * 2,
    (Math.random() - 0.5) * BOUNDS_Y * 2,
  ]
}

export function setup(ctx) {
  ctx.camera.position.set(0, 0, 60)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(1.0)

  // Per-particle state
  ctx._px = new Float32Array(PARTICLE_COUNT)
  ctx._py = new Float32Array(PARTICLE_COUNT)
  ctx._alpha = new Float32Array(PARTICLE_COUNT)

  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const colors = new Float32Array(PARTICLE_COUNT * 3)

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const [x, y] = randomPosition()
    ctx._px[i] = x
    ctx._py[i] = y
    ctx._alpha[i] = Math.random() * SPAWN_ALPHA

    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = 0

    // Initial color — subtle palette (cyan/magenta/gold range)
    const hue = (x / (BOUNDS_X * 2) + 0.5) * 0.6 + 0.5
    const col = new Three.Color()
    col.setHSL(hue % 1, 0.7, 0.6)
    colors[i * 3] = col.r
    colors[i * 3 + 1] = col.g
    colors[i * 3 + 2] = col.b
  }

  const geometry = new Three.BufferGeometry()
  geometry.setAttribute('position', new Three.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Three.BufferAttribute(colors, 3))

  const material = new Three.PointsMaterial({
    size: 1.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: Three.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })

  ctx._points = new Three.Points(geometry, material)
  ctx.add(ctx._points)
}

export function update(ctx, dt) {
  const dt_ = Math.min(dt, 0.05)
  const t = ctx.elapsed * TIME_SCALE
  const posAttr = ctx._points.geometry.attributes.position
  const colAttr = ctx._points.geometry.attributes.color
  const pos = posAttr.array
  const col = colAttr.array

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let px = ctx._px[i]
    let py = ctx._py[i]

    // Sample noise to get flow angle
    const angle = noise2(px * FIELD_SCALE + t, py * FIELD_SCALE + t * 0.7) * Math.PI * 2

    // Move along flow
    px += Math.cos(angle) * SPEED * dt_
    py += Math.sin(angle) * SPEED * dt_

    // Fade alpha
    ctx._alpha[i] -= FADE_RATE

    // Respawn if faded out or out of bounds
    if (ctx._alpha[i] <= 0 ||
        px < -BOUNDS_X || px > BOUNDS_X ||
        py < -BOUNDS_Y || py > BOUNDS_Y) {
      const [nx, ny] = randomPosition()
      px = nx
      py = ny
      ctx._alpha[i] = SPAWN_ALPHA

      // New color based on position
      const hue = (px / (BOUNDS_X * 2) + 0.5) * 0.6 + 0.5 + t * 0.1
      const c = new Three.Color()
      c.setHSL(hue % 1, 0.7, 0.6)
      col[i * 3]     = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }

    ctx._px[i] = px
    ctx._py[i] = py

    pos[i * 3]     = px
    pos[i * 3 + 1] = py
    pos[i * 3 + 2] = 0

    // Modulate color brightness by alpha
    const a = ctx._alpha[i]
    col[i * 3]     *= 0.98 + a * 0.02
    col[i * 3 + 1] *= 0.98 + a * 0.02
    col[i * 3 + 2] *= 0.98 + a * 0.02
  }

  posAttr.needsUpdate = true
  colAttr.needsUpdate = true
}

export function teardown(ctx) {
  ctx.remove(ctx._points)
  ctx._points.geometry.dispose()
  ctx._points.material.dispose()
}

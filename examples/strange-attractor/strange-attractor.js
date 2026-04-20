// strange-attractor — Lorenz attractor drawn live as a glowing BufferGeometry line.
import * as Three from 'three'

const MAX_PTS  = 5000
const PTS_FRAME = 20
const SIGMA = 10
const RHO   = 28
const BETA  = 8 / 3
const DT    = 0.005
const SCALE = 0.18

function lorenzStep(x, y, z) {
  const dx = SIGMA * (y - x)
  const dy = x * (RHO - z) - y
  const dz = x * y - BETA * z
  return [x + dx * DT, y + dy * DT, z + dz * DT]
}

export function setup(ctx) {
  ctx.camera.position.set(0, 0, 22)
  ctx.setBloom(1.5)

  ctx.add(new Three.AmbientLight(0x050510, 1.0))

  ctx._state = [1.0, 1.0, 1.0]
  ctx._pts   = []

  // Pre-allocate buffer for MAX_PTS vertices
  ctx._positions = new Float32Array(MAX_PTS * 3)
  ctx._lineColors = new Float32Array(MAX_PTS * 3)

  const geo = new Three.BufferGeometry()
  ctx._posAttr = new Three.BufferAttribute(ctx._positions, 3)
  ctx._colAttr = new Three.BufferAttribute(ctx._lineColors, 3)
  ctx._posAttr.setUsage(Three.DynamicDrawUsage)
  ctx._colAttr.setUsage(Three.DynamicDrawUsage)
  geo.setAttribute('position', ctx._posAttr)
  geo.setAttribute('color',    ctx._colAttr)
  geo.setDrawRange(0, 0)

  const mat = new Three.LineBasicMaterial({ vertexColors: true })
  ctx._line = new Three.Line(geo, mat)
  ctx.add(ctx._line)

  ctx._lights = [ctx._line]
  ctx._count = 0

  // Slow orbit
  ctx._camAngle = 0
}

export function update(ctx, dt) {
  // Step attractor and record points
  for (let i = 0; i < PTS_FRAME; i++) {
    const [x, y, z] = ctx._state
    const [nx, ny, nz] = lorenzStep(x, y, z)
    ctx._state = [nx, ny, nz]

    if (ctx._count < MAX_PTS) {
      const idx = ctx._count
      ctx._positions[idx * 3]     = nx * SCALE
      ctx._positions[idx * 3 + 1] = (nz - 25) * SCALE
      ctx._positions[idx * 3 + 2] = ny * SCALE

      // HSL gradient along trail (hue cycles 0→1 as points accumulate)
      const t   = idx / MAX_PTS
      const col = new Three.Color().setHSL(t, 1.0, 0.6)
      ctx._lineColors[idx * 3]     = col.r
      ctx._lineColors[idx * 3 + 1] = col.g
      ctx._lineColors[idx * 3 + 2] = col.b

      ctx._count++
    } else {
      // Shift buffer left to create a scrolling trail
      ctx._positions.copyWithin(0, 3)
      ctx._lineColors.copyWithin(0, 3)
      const idx = MAX_PTS - 1
      ctx._positions[idx * 3]     = nx * SCALE
      ctx._positions[idx * 3 + 1] = (nz - 25) * SCALE
      ctx._positions[idx * 3 + 2] = ny * SCALE
      // Recolor entire trail by position
      for (let k = 0; k < MAX_PTS; k++) {
        const hue = k / MAX_PTS
        const c = new Three.Color().setHSL(hue, 1.0, 0.6)
        ctx._lineColors[k * 3]     = c.r
        ctx._lineColors[k * 3 + 1] = c.g
        ctx._lineColors[k * 3 + 2] = c.b
      }
    }
  }

  ctx._posAttr.needsUpdate = true
  ctx._colAttr.needsUpdate = true
  ctx._line.geometry.setDrawRange(0, ctx._count)

  // Orbit camera
  ctx._camAngle += dt * 0.12
  ctx.camera.position.set(
    Math.sin(ctx._camAngle) * 22,
    Math.sin(ctx._camAngle * 0.4) * 5,
    Math.cos(ctx._camAngle) * 22,
  )
  ctx.camera.lookAt(0, 0, 0)
}

export function teardown(ctx) {
  ctx.remove(ctx._line)
}

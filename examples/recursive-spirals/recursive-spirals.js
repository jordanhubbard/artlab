// recursive-spirals — fractal spiral arms, each tip spawning smaller spirals.
import * as Three from 'three'

const MAX_DEPTH = 4
const ARMS = 5
const POINTS_PER_ARM = 60
const PHI = (1 + Math.sqrt(5)) / 2
const SCALE_DECAY = 0.4
const PARTICLE_SIZE = 0.06

function generateSpiral(cx, cy, radius, angleOffset, depth, particles) {
  if (depth > MAX_DEPTH || radius < 0.02) return

  const armCount = depth === 0 ? ARMS : 3
  for (let arm = 0; arm < armCount; arm++) {
    const baseAngle = angleOffset + (arm / armCount) * Math.PI * 2

    for (let i = 0; i < POINTS_PER_ARM; i++) {
      const t = i / POINTS_PER_ARM
      const angle = baseAngle + t * Math.PI * 2.5  // ~2.5 turns
      const r = radius * t
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r
      const hue = (depth * 0.15 + t * 0.3 + arm * 0.1) % 1
      const brightness = 0.5 + (1 - depth / MAX_DEPTH) * 0.3
      const size = radius * PARTICLE_SIZE * (1 - t * 0.5)
      particles.push({ x, y, hue, brightness, size, depth })
    }

    // Recurse at the tip of each arm
    const tipAngle = baseAngle + Math.PI * 2.5
    const tipR = radius
    const tipX = cx + Math.cos(tipAngle) * tipR
    const tipY = cy + Math.sin(tipAngle) * tipR
    generateSpiral(tipX, tipY, radius * SCALE_DECAY, tipAngle, depth + 1, particles)
  }
}

export function setup(ctx) {
  ctx.camera.position.set(0, 0, 18)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(0.7)

  const ambient = new Three.AmbientLight(0x111122, 0.5)
  ctx.add(ambient)
  ctx._lights = [ambient]

  // Generate all spiral particles
  const particleData = []
  generateSpiral(0, 0, 5, 0, 0, particleData)

  const count = particleData.length
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  ctx._basePositions = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const p = particleData[i]
    positions[i * 3] = p.x
    positions[i * 3 + 1] = p.y
    positions[i * 3 + 2] = 0
    ctx._basePositions[i * 3] = p.x
    ctx._basePositions[i * 3 + 1] = p.y
    ctx._basePositions[i * 3 + 2] = 0

    const c = new Three.Color().setHSL(p.hue, 0.8, p.brightness)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
    sizes[i] = p.size
  }

  const geo = new Three.BufferGeometry()
  geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new Three.Float32BufferAttribute(colors, 3))
  geo.setAttribute('size', new Three.Float32BufferAttribute(sizes, 1))

  ctx._points = new Three.Points(geo, new Three.PointsMaterial({
    size: 0.08, vertexColors: true, transparent: true, opacity: 0.85,
    blending: Three.AdditiveBlending, depthWrite: false,
    sizeAttenuation: true,
  }))
  ctx.add(ctx._points)

  ctx._particleCount = count
  ctx._rotationSpeed = 0.08
}

export function update(ctx, dt) {
  const dt_ = Math.min(dt, 0.05)
  const time = ctx.elapsed || 0

  // Gentle overall rotation
  ctx._points.rotation.z += dt_ * ctx._rotationSpeed

  // Subtle breathing / wave animation
  const pos = ctx._points.geometry.attributes.position.array
  const base = ctx._basePositions
  for (let i = 0; i < ctx._particleCount; i++) {
    const bx = base[i * 3]
    const by = base[i * 3 + 1]
    const dist = Math.sqrt(bx * bx + by * by)
    const wave = Math.sin(time * 0.5 + dist * 0.8) * 0.15
    pos[i * 3] = bx + wave * (bx / (dist + 0.1)) * 0.3
    pos[i * 3 + 1] = by + wave * (by / (dist + 0.1)) * 0.3
  }
  ctx._points.geometry.attributes.position.needsUpdate = true

  // Color cycling
  const cols = ctx._points.geometry.attributes.color.array
  for (let i = 0; i < ctx._particleCount; i++) {
    const hue = (i / ctx._particleCount + time * 0.02) % 1
    const c = new Three.Color().setHSL(hue, 0.8, 0.6)
    cols[i * 3] = c.r
    cols[i * 3 + 1] = c.g
    cols[i * 3 + 2] = c.b
  }
  ctx._points.geometry.attributes.color.needsUpdate = true
}

export function teardown(ctx) {
  ctx.remove(ctx._points)
  ctx._points.geometry.dispose()
  ctx._points.material.dispose()
  for (const l of ctx._lights) ctx.remove(l)
}

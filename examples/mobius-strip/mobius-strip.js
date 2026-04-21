// mobius-strip — parametric Möbius strip with flowing colors and tracing particles.
import * as Three from 'three'

const SEGMENTS_U = 120
const SEGMENTS_V = 20
const HALF_WIDTH = 1.5
const RADIUS     = 4
const PARTICLES  = 200

function mobiusPoint(u, v) {
  // u in [0, 2π], v in [-1, 1]
  const halfAngle = u / 2
  const r = RADIUS + v * HALF_WIDTH * Math.cos(halfAngle)
  return new Three.Vector3(
    r * Math.cos(u),
    v * HALF_WIDTH * Math.sin(halfAngle),
    r * Math.sin(u),
  )
}

function buildStripGeometry() {
  const positions = []
  const colors = []
  const indices = []

  for (let i = 0; i <= SEGMENTS_U; i++) {
    const u = (i / SEGMENTS_U) * Math.PI * 2
    for (let j = 0; j <= SEGMENTS_V; j++) {
      const v = (j / SEGMENTS_V) * 2 - 1
      const p = mobiusPoint(u, v)
      positions.push(p.x, p.y, p.z)

      const hue = (i / SEGMENTS_U + v * 0.1 + 0.5) % 1
      const c = new Three.Color().setHSL(hue, 0.7, 0.55)
      colors.push(c.r, c.g, c.b)
    }
  }

  for (let i = 0; i < SEGMENTS_U; i++) {
    for (let j = 0; j < SEGMENTS_V; j++) {
      const a = i * (SEGMENTS_V + 1) + j
      const b = a + SEGMENTS_V + 1
      indices.push(a, b, a + 1)
      indices.push(b, b + 1, a + 1)
    }
  }

  const geo = new Three.BufferGeometry()
  geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new Three.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export function setup(ctx) {
  ctx.camera.position.set(0, 6, 10)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(0.5)

  const ambient = new Three.AmbientLight(0x445566, 1.0)
  ctx.add(ambient)
  const sun = new Three.DirectionalLight(0xffeedd, 1.3)
  sun.position.set(5, 10, 5)
  ctx.add(sun)
  ctx._lights = [ambient, sun]

  // Build the strip (double-sided)
  const geo = buildStripGeometry()
  const mat = new Three.MeshStandardMaterial({
    vertexColors: true, side: Three.DoubleSide,
    roughness: 0.35, metalness: 0.4,
  })
  ctx._strip = new Three.Mesh(geo, mat)
  ctx.add(ctx._strip)

  // Wireframe overlay
  const wire = new Three.Mesh(geo, new Three.MeshBasicMaterial({
    wireframe: true, color: 0xffffff, transparent: true, opacity: 0.06,
  }))
  ctx.add(wire)
  ctx._wire = wire

  // Tracing particles
  const pGeo = new Three.BufferGeometry()
  const pPositions = new Float32Array(PARTICLES * 3)
  const pColors = new Float32Array(PARTICLES * 3)
  ctx._particleU = new Float32Array(PARTICLES)
  ctx._particleV = new Float32Array(PARTICLES)
  ctx._particleSpeed = new Float32Array(PARTICLES)

  for (let i = 0; i < PARTICLES; i++) {
    ctx._particleU[i] = Math.random() * Math.PI * 2
    ctx._particleV[i] = Math.random() * 2 - 1
    ctx._particleSpeed[i] = 0.3 + Math.random() * 0.5
    const p = mobiusPoint(ctx._particleU[i], ctx._particleV[i])
    pPositions[i * 3] = p.x
    pPositions[i * 3 + 1] = p.y
    pPositions[i * 3 + 2] = p.z
    const c = new Three.Color().setHSL(Math.random(), 0.9, 0.7)
    pColors[i * 3] = c.r
    pColors[i * 3 + 1] = c.g
    pColors[i * 3 + 2] = c.b
  }

  pGeo.setAttribute('position', new Three.Float32BufferAttribute(pPositions, 3))
  pGeo.setAttribute('color', new Three.Float32BufferAttribute(pColors, 3))

  ctx._particles = new Three.Points(pGeo, new Three.PointsMaterial({
    size: 0.08, vertexColors: true, transparent: true, opacity: 0.9,
    blending: Three.AdditiveBlending, depthWrite: false,
  }))
  ctx.add(ctx._particles)
}

export function update(ctx, dt) {
  const dt_ = Math.min(dt, 0.05)
  ctx._strip.rotation.y += dt_ * 0.15

  if (ctx._wire) ctx._wire.rotation.y = ctx._strip.rotation.y

  // Update particles
  const pos = ctx._particles.geometry.attributes.position.array
  for (let i = 0; i < PARTICLES; i++) {
    ctx._particleU[i] = (ctx._particleU[i] + ctx._particleSpeed[i] * dt_) % (Math.PI * 2)
    const p = mobiusPoint(ctx._particleU[i], ctx._particleV[i])
    // Apply strip rotation
    const cosR = Math.cos(ctx._strip.rotation.y)
    const sinR = Math.sin(ctx._strip.rotation.y)
    pos[i * 3]     = p.x * cosR + p.z * sinR
    pos[i * 3 + 1] = p.y
    pos[i * 3 + 2] = -p.x * sinR + p.z * cosR
  }
  ctx._particles.geometry.attributes.position.needsUpdate = true
}

export function teardown(ctx) {
  ctx.remove(ctx._strip)
  ctx.remove(ctx._wire)
  ctx.remove(ctx._particles)
  ctx._strip.geometry.dispose()
  ctx._strip.material.dispose()
  ctx._wire.material.dispose()
  ctx._particles.geometry.dispose()
  ctx._particles.material.dispose()
  for (const l of ctx._lights) ctx.remove(l)
}

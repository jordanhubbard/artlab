// cloth-sim — Verlet integration cloth with wind and mouse drag.
import * as Three from 'three'

const COLS = 30
const ROWS = 24
const REST_DIST = 0.3
const GRAVITY = new Three.Vector3(0, -9.8, 0)
const DAMPING = 0.97
const ITERATIONS = 5
const WIND_STRENGTH = 2.5

class Particle {
  constructor(x, y, z, pinned = false) {
    this.pos = new Three.Vector3(x, y, z)
    this.prev = new Three.Vector3(x, y, z)
    this.pinned = pinned
    this.mass = 1
  }
}

class Constraint {
  constructor(a, b, rest) {
    this.a = a
    this.b = b
    this.rest = rest
  }

  solve() {
    const diff = new Three.Vector3().subVectors(this.b.pos, this.a.pos)
    const dist = diff.length()
    if (dist < 0.0001) return
    const correction = diff.multiplyScalar((dist - this.rest) / dist * 0.5)
    if (!this.a.pinned) this.a.pos.add(correction)
    if (!this.b.pinned) this.b.pos.sub(correction)
  }
}

function buildCloth() {
  const particles = []
  const constraints = []

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = (c - COLS / 2) * REST_DIST
      const y = 4 - r * REST_DIST
      const z = 0
      const pinned = r === 0 && (c % 4 === 0 || c === COLS - 1)
      particles.push(new Particle(x, y, z, pinned))
    }
  }

  // Structural constraints
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c
      if (c < COLS - 1) constraints.push(new Constraint(particles[i], particles[i + 1], REST_DIST))
      if (r < ROWS - 1) constraints.push(new Constraint(particles[i], particles[i + COLS], REST_DIST))
    }
  }

  return { particles, constraints }
}

function simulate(cloth, dt, wind) {
  const dt2 = dt * dt

  for (const p of cloth.particles) {
    if (p.pinned) continue
    const vel = new Three.Vector3().subVectors(p.pos, p.prev).multiplyScalar(DAMPING)
    const accel = GRAVITY.clone().add(wind).multiplyScalar(dt2)
    p.prev.copy(p.pos)
    p.pos.add(vel).add(accel)
  }

  for (let i = 0; i < ITERATIONS; i++) {
    for (const c of cloth.constraints) {
      c.solve()
    }
  }
}

function updateMesh(mesh, cloth) {
  const pos = mesh.geometry.attributes.position.array
  for (let i = 0; i < cloth.particles.length; i++) {
    pos[i * 3] = cloth.particles[i].pos.x
    pos[i * 3 + 1] = cloth.particles[i].pos.y
    pos[i * 3 + 2] = cloth.particles[i].pos.z
  }
  mesh.geometry.attributes.position.needsUpdate = true
  mesh.geometry.computeVertexNormals()
}

export function setup(ctx) {
  ctx.camera.position.set(0, 3, 8)
  ctx.camera.lookAt(0, 1, 0)
  ctx.setBloom(0.2)

  const ambient = new Three.AmbientLight(0x445566, 1.0)
  ctx.add(ambient)
  const sun = new Three.DirectionalLight(0xffeedd, 1.4)
  sun.position.set(3, 8, 5)
  ctx.add(sun)
  ctx._lights = [ambient, sun]

  ctx._cloth = buildCloth()

  // Build mesh
  const geo = new Three.BufferGeometry()
  const positions = new Float32Array(ROWS * COLS * 3)
  for (let i = 0; i < ctx._cloth.particles.length; i++) {
    positions[i * 3] = ctx._cloth.particles[i].pos.x
    positions[i * 3 + 1] = ctx._cloth.particles[i].pos.y
    positions[i * 3 + 2] = ctx._cloth.particles[i].pos.z
  }
  geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3))

  // Indices for grid faces
  const indices = []
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const i = r * COLS + c
      indices.push(i, i + 1, i + COLS)
      indices.push(i + 1, i + COLS + 1, i + COLS)
    }
  }
  geo.setIndex(indices)
  geo.computeVertexNormals()

  // UV for color variation
  const uvs = new Float32Array(ROWS * COLS * 2)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      uvs[(r * COLS + c) * 2] = c / (COLS - 1)
      uvs[(r * COLS + c) * 2 + 1] = r / (ROWS - 1)
    }
  }
  geo.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2))

  const mat = new Three.MeshStandardMaterial({
    color: 0xcc4444, side: Three.DoubleSide,
    roughness: 0.7, metalness: 0.1,
  })
  ctx._clothMesh = new Three.Mesh(geo, mat)
  ctx.add(ctx._clothMesh)

  // Pin markers
  ctx._pinMarkers = []
  for (const p of ctx._cloth.particles) {
    if (p.pinned) {
      const sphere = new Three.Mesh(
        new Three.SphereGeometry(0.06, 8, 8),
        new Three.MeshStandardMaterial({ color: 0xffcc00 }),
      )
      sphere.position.copy(p.pos)
      ctx.add(sphere)
      ctx._pinMarkers.push(sphere)
    }
  }

  ctx._windTime = 0
}

export function update(ctx, dt) {
  const dt_ = Math.min(dt, 0.02) // cap for stability
  ctx._windTime += dt_

  // Oscillating wind
  const windZ = Math.sin(ctx._windTime * 0.7) * WIND_STRENGTH
  const windX = Math.cos(ctx._windTime * 0.3) * WIND_STRENGTH * 0.3
  const wind = new Three.Vector3(windX, 0, windZ)

  simulate(ctx._cloth, dt_, wind)
  updateMesh(ctx._clothMesh, ctx._cloth)
}

export function teardown(ctx) {
  ctx.remove(ctx._clothMesh)
  ctx._clothMesh.geometry.dispose()
  ctx._clothMesh.material.dispose()
  for (const m of ctx._pinMarkers) {
    ctx.remove(m)
    m.geometry.dispose()
    m.material.dispose()
  }
  for (const l of ctx._lights) ctx.remove(l)
}

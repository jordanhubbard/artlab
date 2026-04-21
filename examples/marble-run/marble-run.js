// marble-run — spiral ramps, platforms, and marbles with simple physics.
import * as Three from 'three'

const GRAVITY = -15
const BOUNCE = 0.55
const FRICTION = 0.98
const MAX_MARBLES = 30
const SPAWN_INTERVAL = 1.2

// Ramp segment: start/end + normal for collision
function buildRamps() {
  const ramps = []

  // Spiral down: 6 alternating ramps
  const levels = [
    { x1: -3, z1: 0, x2: 2, z2: 0, y: 5, tilt: -0.15 },
    { x1: 3, z1: 0, x2: -2, z2: 0, y: 3.8, tilt: -0.12 },
    { x1: -3, z1: 0, x2: 2, z2: 0, y: 2.6, tilt: -0.15 },
    { x1: 3, z1: 0, x2: -2, z2: 0, y: 1.4, tilt: -0.12 },
    { x1: -3, z1: 0, x2: 2, z2: 0, y: 0.2, tilt: -0.15 },
    { x1: 3, z1: 0, x2: -2, z2: 0, y: -1.0, tilt: -0.10 },
  ]

  for (const l of levels) {
    const length = Math.abs(l.x2 - l.x1)
    ramps.push({
      cx: (l.x1 + l.x2) / 2,
      cy: l.y,
      cz: 0,
      width: length,
      depth: 1.2,
      tilt: l.tilt,
      minX: Math.min(l.x1, l.x2),
      maxX: Math.max(l.x1, l.x2),
    })
  }
  return ramps
}

function buildRampMeshes(ramps) {
  const meshes = []
  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i]
    const geo = new Three.BoxGeometry(r.width, 0.12, r.depth)
    const hue = i / ramps.length * 0.6
    const mat = new Three.MeshStandardMaterial({
      color: new Three.Color().setHSL(hue, 0.5, 0.45),
      roughness: 0.6, metalness: 0.2,
    })
    const mesh = new Three.Mesh(geo, mat)
    mesh.position.set(r.cx, r.cy, r.cz)
    mesh.rotation.z = r.tilt
    meshes.push(mesh)
  }
  return meshes
}

class Marble {
  constructor(x, y, z, hue) {
    this.pos = new Three.Vector3(x, y, z)
    this.vel = new Three.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.3)
    this.radius = 0.12 + Math.random() * 0.06
    this.hue = hue
    this.mesh = null
    this.alive = true
  }
}

function createMarbleMesh(marble) {
  const geo = new Three.SphereGeometry(marble.radius, 16, 12)
  const mat = new Three.MeshStandardMaterial({
    color: new Three.Color().setHSL(marble.hue, 0.8, 0.55),
    roughness: 0.15, metalness: 0.8,
  })
  return new Three.Mesh(geo, mat)
}

function collideWithRamps(marble, ramps) {
  for (const r of ramps) {
    // Check if marble is above this ramp
    const mx = marble.pos.x
    const my = marble.pos.y
    if (mx < r.minX - marble.radius || mx > r.maxX + marble.radius) continue

    // Ramp surface Y at marble's X (accounting for tilt)
    const dx = mx - r.cx
    const surfaceY = r.cy + dx * Math.sin(r.tilt) + 0.06 // half thickness

    if (my - marble.radius < surfaceY && my > surfaceY - 0.5 && Math.abs(marble.pos.z) < r.depth / 2 + marble.radius) {
      marble.pos.y = surfaceY + marble.radius
      marble.vel.y *= -BOUNCE
      if (Math.abs(marble.vel.y) < 0.3) marble.vel.y = 0

      // Slide along tilt
      marble.vel.x += Math.sin(r.tilt) * 8 * 0.016
      marble.vel.x *= FRICTION
      marble.vel.z *= FRICTION
    }
  }
}

export function setup(ctx) {
  ctx.camera.position.set(0, 3, 10)
  ctx.camera.lookAt(0, 2, 0)
  ctx.setBloom(0.3)

  const ambient = new Three.AmbientLight(0x556677, 0.8)
  ctx.add(ambient)
  const sun = new Three.DirectionalLight(0xffffff, 1.3)
  sun.position.set(5, 10, 8)
  ctx.add(sun)
  const fill = new Three.DirectionalLight(0x4488cc, 0.4)
  fill.position.set(-5, 5, -3)
  ctx.add(fill)
  ctx._lights = [ambient, sun, fill]

  ctx._ramps = buildRamps()
  ctx._rampMeshes = buildRampMeshes(ctx._ramps)
  for (const m of ctx._rampMeshes) ctx.add(m)

  // Collection bowl at the bottom
  const bowlGeo = new Three.CylinderGeometry(2, 1.5, 0.5, 24, 1, true)
  const bowlMat = new Three.MeshStandardMaterial({
    color: 0x666688, side: Three.DoubleSide, roughness: 0.3, metalness: 0.5,
  })
  ctx._bowl = new Three.Mesh(bowlGeo, bowlMat)
  ctx._bowl.position.set(0, -2.5, 0)
  ctx.add(ctx._bowl)

  ctx._marbles = []
  ctx._spawnTimer = 0
  ctx._marbleIndex = 0
}

export function update(ctx, dt) {
  const dt_ = Math.min(dt, 0.03)

  // Spawn marbles
  ctx._spawnTimer += dt_
  if (ctx._spawnTimer > SPAWN_INTERVAL && ctx._marbles.length < MAX_MARBLES) {
    ctx._spawnTimer = 0
    const hue = (ctx._marbleIndex * 0.13) % 1
    const marble = new Marble(-2 + Math.random() * 0.5, 6.5, (Math.random() - 0.5) * 0.3, hue)
    marble.mesh = createMarbleMesh(marble)
    marble.mesh.position.copy(marble.pos)
    ctx.add(marble.mesh)
    ctx._marbles.push(marble)
    ctx._marbleIndex++
  }

  // Simulate
  for (const m of ctx._marbles) {
    if (!m.alive) continue

    m.vel.y += GRAVITY * dt_
    m.pos.x += m.vel.x * dt_
    m.pos.y += m.vel.y * dt_
    m.pos.z += m.vel.z * dt_

    collideWithRamps(m, ctx._ramps)

    // Floor / bowl collision
    if (m.pos.y - m.radius < -2.5) {
      m.pos.y = -2.5 + m.radius
      m.vel.y *= -BOUNCE * 0.5
      m.vel.x *= 0.92
      m.vel.z *= 0.92
      if (Math.abs(m.vel.y) < 0.1) m.vel.y = 0
    }

    // Kill if too far
    if (m.pos.y < -10) m.alive = false

    m.mesh.position.copy(m.pos)
    // Roll rotation
    m.mesh.rotation.x += m.vel.z * dt_ * 5
    m.mesh.rotation.z -= m.vel.x * dt_ * 5
  }

  // Remove dead marbles
  ctx._marbles = ctx._marbles.filter(m => {
    if (!m.alive) {
      ctx.remove(m.mesh)
      m.mesh.geometry.dispose()
      m.mesh.material.dispose()
    }
    return m.alive
  })
}

export function teardown(ctx) {
  for (const m of ctx._rampMeshes) {
    ctx.remove(m)
    m.geometry.dispose()
    m.material.dispose()
  }
  ctx.remove(ctx._bowl)
  ctx._bowl.geometry.dispose()
  ctx._bowl.material.dispose()
  for (const m of ctx._marbles) {
    ctx.remove(m.mesh)
    m.mesh.geometry.dispose()
    m.mesh.material.dispose()
  }
  for (const l of ctx._lights) ctx.remove(l)
}

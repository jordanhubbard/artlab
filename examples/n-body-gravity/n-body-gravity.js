// n-body-gravity — Gravitational N-body simulation with trails, merging, and click-to-spawn.
import * as Three from 'three'
import { body, integrate, applyForce } from '../../src/physics/Physics.js'

const G           = 40
const INITIAL_N   = 30
const TRAIL_LEN   = 60
const BOUNDS      = 40
const SOFTENING   = 0.5   // avoid singularity
const MIN_RADIUS  = 0.15
const DENSITY     = 1.0   // mass = density * volume

function radiusFromMass(mass) {
  return Math.max(MIN_RADIUS, Math.cbrt(mass / (DENSITY * (4 / 3) * Math.PI)))
}

function randomColor() {
  const h = Math.random()
  const s = 0.6 + Math.random() * 0.4
  const l = 0.5 + Math.random() * 0.3
  const c = new Three.Color()
  c.setHSL(h, s, l)
  return c
}

function createBody(ctx, pos, vel, mass) {
  const pb = body({
    position: pos || new Three.Vector3(
      (Math.random() - 0.5) * BOUNDS,
      (Math.random() - 0.5) * BOUNDS,
      0,
    ),
    velocity: vel || new Three.Vector3(
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
      0,
    ),
    mass: mass || 0.5 + Math.random() * 3,
  })

  const radius = radiusFromMass(pb.mass)
  const color = randomColor()
  const geo = new Three.SphereGeometry(radius, 16, 12)
  const mat = new Three.MeshBasicMaterial({ color })
  const mesh = new Three.Mesh(geo, mat)
  mesh.position.copy(pb.position)
  ctx.add(mesh)

  // Trail
  const trailPositions = new Float32Array(TRAIL_LEN * 3)
  for (let i = 0; i < TRAIL_LEN; i++) {
    trailPositions[i * 3]     = pb.position.x
    trailPositions[i * 3 + 1] = pb.position.y
    trailPositions[i * 3 + 2] = pb.position.z
  }
  const trailGeo = new Three.BufferGeometry()
  trailGeo.setAttribute('position', new Three.BufferAttribute(trailPositions, 3))
  const trailMat = new Three.LineBasicMaterial({ color, transparent: true, opacity: 0.4 })
  const trail = new Three.Line(trailGeo, trailMat)
  ctx.add(trail)

  return {
    phys: pb,
    mesh,
    trail,
    trailGeo,
    trailMat,
    radius,
    color,
    alive: true,
    trailIdx: 0,
  }
}

function mergeBodies(ctx, a, b) {
  // Conservation of momentum
  const totalMass = a.phys.mass + b.phys.mass
  const newVel = new Three.Vector3()
    .addScaledVector(a.phys.velocity, a.phys.mass)
    .addScaledVector(b.phys.velocity, b.phys.mass)
    .divideScalar(totalMass)

  a.phys.mass = totalMass
  a.phys.velocity.copy(newVel)
  a.radius = radiusFromMass(totalMass)

  // Rebuild sphere with new radius
  a.mesh.geometry.dispose()
  a.mesh.geometry = new Three.SphereGeometry(a.radius, 16, 12)

  // Mark b as dead
  b.alive = false
  ctx.remove(b.mesh)
  ctx.remove(b.trail)
  b.mesh.geometry.dispose()
  b.mesh.material.dispose()
  b.trailGeo.dispose()
  b.trailMat.dispose()
}

export function setup(ctx) {
  ctx.camera.position.set(0, 0, 60)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(1.2)

  ctx._bodies = []
  for (let i = 0; i < INITIAL_N; i++) {
    ctx._bodies.push(createBody(ctx))
  }

  // Click-to-spawn: invisible plane for raycasting
  const planeGeo = new Three.PlaneGeometry(200, 200)
  const planeMat = new Three.MeshBasicMaterial({ visible: false })
  ctx._clickPlane = new Three.Mesh(planeGeo, planeMat)
  ctx.add(ctx._clickPlane)

  ctx._raycaster = new Three.Raycaster()
  ctx._mouse = new Three.Vector2()

  ctx._onClick = (event) => {
    const rect = ctx.renderer.domElement.getBoundingClientRect()
    ctx._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    ctx._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    ctx._raycaster.setFromCamera(ctx._mouse, ctx.camera)
    const hits = ctx._raycaster.intersectObject(ctx._clickPlane)
    if (hits.length > 0) {
      const p = hits[0].point.clone()
      p.z = 0
      ctx._bodies.push(createBody(ctx, p, new Three.Vector3(0, 0, 0), 2.0))
    }
  }
  ctx.renderer.domElement.addEventListener('click', ctx._onClick)
}

const _diff = new Three.Vector3()
const _force = new Three.Vector3()

export function update(ctx, dt) {
  const dt_ = Math.min(dt, 0.03)
  const bodies = ctx._bodies

  // Compute gravitational forces (N-body pairwise)
  for (let i = 0; i < bodies.length; i++) {
    if (!bodies[i].alive) continue
    for (let j = i + 1; j < bodies.length; j++) {
      if (!bodies[j].alive) continue
      const a = bodies[i]
      const b = bodies[j]

      _diff.subVectors(b.phys.position, a.phys.position)
      const distSq = _diff.lengthSq() + SOFTENING * SOFTENING
      const dist = Math.sqrt(distSq)
      const magnitude = G * a.phys.mass * b.phys.mass / distSq

      _force.copy(_diff).normalize().multiplyScalar(magnitude)
      applyForce(a.phys, _force)
      applyForce(b.phys, _force.clone().negate())
    }
  }

  // Integrate
  for (const b of bodies) {
    if (!b.alive) continue
    integrate(b.phys, dt_)
    b.mesh.position.copy(b.phys.position)

    // Update trail
    const pos = b.trailGeo.attributes.position.array
    // Shift trail positions
    for (let i = TRAIL_LEN - 1; i > 0; i--) {
      pos[i * 3]     = pos[(i - 1) * 3]
      pos[i * 3 + 1] = pos[(i - 1) * 3 + 1]
      pos[i * 3 + 2] = pos[(i - 1) * 3 + 2]
    }
    pos[0] = b.phys.position.x
    pos[1] = b.phys.position.y
    pos[2] = b.phys.position.z
    b.trailGeo.attributes.position.needsUpdate = true
  }

  // Check for merges
  for (let i = 0; i < bodies.length; i++) {
    if (!bodies[i].alive) continue
    for (let j = i + 1; j < bodies.length; j++) {
      if (!bodies[j].alive) continue
      const dist = bodies[i].phys.position.distanceTo(bodies[j].phys.position)
      if (dist < bodies[i].radius + bodies[j].radius) {
        // Merge smaller into larger
        if (bodies[i].phys.mass >= bodies[j].phys.mass) {
          mergeBodies(ctx, bodies[i], bodies[j])
        } else {
          mergeBodies(ctx, bodies[j], bodies[i])
        }
      }
    }
  }

  // Remove dead bodies
  ctx._bodies = ctx._bodies.filter(b => b.alive)
}

export function teardown(ctx) {
  for (const b of ctx._bodies) {
    ctx.remove(b.mesh)
    ctx.remove(b.trail)
    b.mesh.geometry.dispose()
    b.mesh.material.dispose()
    b.trailGeo.dispose()
    b.trailMat.dispose()
  }
  ctx.remove(ctx._clickPlane)
  ctx._clickPlane.geometry.dispose()
  ctx._clickPlane.material.dispose()
  ctx.renderer.domElement.removeEventListener('click', ctx._onClick)
}

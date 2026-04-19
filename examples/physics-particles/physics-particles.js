// Physics Particles — fountain of particles that arc under real physics. Click to move it.

import * as Three from 'three'
import { body, integrate, gravityForce, dragForce } from '../../src/physics/Physics.js'

const GROUND_Y   = -3
const PARTICLE_N = 300
const EMIT_RATE  = 80    // particles per second
const LIFETIME   = 3     // seconds
const UP_SPEED   = 12
const SPREAD     = 0.4   // cone half-angle (rad)
const GRAVITY    = 4     // artistic scale, m/s²
const DRAG_K     = 0.08

function spawnParticle(p, origin) {
  const theta = Math.random() * SPREAD
  const phi   = Math.random() * Math.PI * 2
  const sinT  = Math.sin(theta)
  p.velocity.set(
    Math.cos(phi) * sinT * UP_SPEED,
    Math.cos(theta)      * UP_SPEED,
    Math.sin(phi) * sinT * UP_SPEED,
  )
  p.position.copy(origin)
  p._age   = 0
  p._alive = true
}

export function setup(ctx) {
  ctx.camera.position.set(0, 4, 18)
  ctx.camera.lookAt(0, 2, 0)
  ctx.setBloom(1.2)

  ctx.add(new Three.AmbientLight(0x112233, 1.0))

  const groundGeo = new Three.PlaneGeometry(40, 40)
  const groundMat = new Three.MeshStandardMaterial({ color: 0x0a0a14, roughness: 1 })
  ctx._ground = new Three.Mesh(groundGeo, groundMat)
  ctx._ground.rotation.x = -Math.PI / 2
  ctx._ground.position.y = GROUND_Y
  ctx.add(ctx._ground)

  ctx._origin    = new Three.Vector3(0, GROUND_Y, 0)
  ctx._emitAcc   = 0

  ctx._particles = Array.from({ length: PARTICLE_N }, () => {
    const p = body({ mass: 1 })
    p._alive = false
    p._age   = 0
    return p
  })

  ctx._instanced = new Three.InstancedMesh(
    new Three.SphereGeometry(0.12, 6, 4),
    new Three.MeshStandardMaterial({
      color: 0x66aaff, emissive: new Three.Color(0x224488),
      roughness: 0.6, metalness: 0.2,
    }),
    PARTICLE_N
  )
  ctx.add(ctx._instanced)
  ctx._dummy = new Three.Object3D()

  const raycaster   = new Three.Raycaster()
  const mouse       = new Three.Vector2()
  const groundPlane = new Three.Plane(new Three.Vector3(0, 1, 0), -GROUND_Y)

  ctx._onClick = (e) => {
    const rect = ctx.renderer.domElement.getBoundingClientRect()
    mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, ctx.camera)
    const hit = new Three.Vector3()
    if (raycaster.ray.intersectPlane(groundPlane, hit)) {
      ctx._origin.set(hit.x, GROUND_Y, hit.z)
    }
  }
  window.addEventListener('click', ctx._onClick)
}

export function update(ctx, dt) {
  ctx._emitAcc += EMIT_RATE * dt
  let toEmit = Math.floor(ctx._emitAcc)
  ctx._emitAcc -= toEmit

  const grav = gravityForce(1, GRAVITY)

  for (let i = 0; i < PARTICLE_N; i++) {
    const p = ctx._particles[i]

    if (!p._alive) {
      if (toEmit > 0) { spawnParticle(p, ctx._origin); toEmit-- }
      else {
        ctx._dummy.scale.setScalar(0)
        ctx._dummy.position.set(0, -1000, 0)
        ctx._dummy.updateMatrix()
        ctx._instanced.setMatrixAt(i, ctx._dummy.matrix)
        continue
      }
    }

    p._age += dt
    p.force.copy(grav).add(dragForce(p.velocity, DRAG_K))
    integrate(p, dt)

    if (p.position.y < GROUND_Y || p._age > LIFETIME) {
      p._alive = false
      ctx._dummy.scale.setScalar(0)
      ctx._dummy.position.set(0, -1000, 0)
    } else {
      const fade = 1 - p._age / LIFETIME
      ctx._dummy.scale.setScalar(0.4 + fade * 0.6)
      ctx._dummy.position.copy(p.position)
    }
    ctx._dummy.updateMatrix()
    ctx._instanced.setMatrixAt(i, ctx._dummy.matrix)
  }

  ctx._instanced.instanceMatrix.needsUpdate = true
}

export function teardown(ctx) {
  window.removeEventListener('click', ctx._onClick)
  ctx._ground.geometry.dispose()
  ctx._ground.material.dispose()
  ctx.remove(ctx._ground)
  ctx._instanced.geometry.dispose()
  ctx._instanced.material.dispose()
  ctx.remove(ctx._instanced)
}

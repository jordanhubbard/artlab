// Physics Particles — click to move the fountain; particles stream up, arc under gravity, and glow.

import * as THREE from 'three'
import { createParticleWorld, emitter, forceField } from '../../src/stdlib/physics/particles.js'

const GROUND_Y = -3

export function setup(ctx) {
  ctx.camera.position.set(0, 4, 18)
  ctx.camera.lookAt(0, 2, 0)
  ctx.setBloom(1.2)

  ctx.add(new THREE.AmbientLight(0x112233, 1.0))

  const groundGeo = new THREE.PlaneGeometry(40, 40)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 1 })
  ctx._ground = new THREE.Mesh(groundGeo, groundMat)
  ctx._ground.rotation.x = -Math.PI / 2
  ctx._ground.position.y = GROUND_Y
  ctx.add(ctx._ground)

  ctx._world   = createParticleWorld()
  ctx._emitter = emitter(ctx._world, ctx.scene, {
    rate: 80, speed: 12, spread: 0.4 * (180 / Math.PI),
    lifetime: 3, color: 0x66aaff, size: 0.15, gravity: 4,
  })
  ctx._origin = new THREE.Vector3(0, GROUND_Y, 0)
  ctx._emitter.points.position.copy(ctx._origin)

  const raycaster  = new THREE.Raycaster()
  const mouse      = new THREE.Vector2()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y)

  ctx._onClick = (e) => {
    const rect = ctx.renderer.domElement.getBoundingClientRect()
    mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, ctx.camera)
    const hit = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(groundPlane, hit)) {
      ctx._origin.set(hit.x, GROUND_Y, hit.z)
      ctx._emitter.points.position.copy(ctx._origin)
    }
  }
  window.addEventListener('click', ctx._onClick)
}

export function update(ctx, dt) {
  const center = { x: ctx._origin.x, y: ctx._origin.y + 2, z: ctx._origin.z }
  forceField(ctx._world, ctx._emitter.emitterId, center, 3, { x: 0, y: 1.5 * dt, z: 0 })
  ctx._emitter.update(ctx.elapsed, dt)
}

export function teardown(ctx) {
  window.removeEventListener('click', ctx._onClick)
  ctx._emitter.dispose()
  ctx._ground.geometry.dispose()
  ctx._ground.material.dispose()
  ctx.remove(ctx._ground)
}

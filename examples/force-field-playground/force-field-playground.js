// force-field-playground.js — click the scene to place attractor/repulsor force fields among streaming particles
import * as THREE from 'three'
import { createParticleWorld, emitter, forceField } from '../../src/stdlib/physics/particles.js'
import { label, hud } from '../../src/stdlib/ui.js'

const MAX_FIELDS    = 8
const FIELD_RADIUS  = 6
const FIELD_STR     = 18
const MAX_PARTICLES = 3000
const MAX_SPEED     = 14

let pworld, particleEmitter, colorAttr, colorBuf
let groundPlane, ambientLight, ptLight
let infoHud
let fields      = []
let fieldToggle = 0
let _onClick

export function setup(ctx) {
  fields      = []
  fieldToggle = 0

  ctx.setHelp('Click the ground to place force fields (alternates attractor / repulsor, max 8)')
  ctx.camera.position.set(0, 20, 25)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(1.4)

  ambientLight = new THREE.AmbientLight(0x0a0a1a, 1.0)
  ctx.add(ambientLight)
  ptLight = new THREE.PointLight(0x2244ff, 3.0, 50)
  ptLight.position.set(0, 10, 0)
  ctx.add(ptLight)

  pworld          = createParticleWorld()
  particleEmitter = emitter(pworld, ctx.scene, {
    rate: 120, speed: 8, spread: 180, lifetime: 3.5,
    color: 0x4488ff, size: 0.18, gravity: 0, maxParticles: MAX_PARTICLES,
  })

  // Vertex colours let us tint each particle by its current speed
  const geo = particleEmitter.points.geometry
  const mat = particleEmitter.points.material
  colorBuf  = new Float32Array(MAX_PARTICLES * 3)
  colorAttr = new THREE.BufferAttribute(colorBuf, 3)
  colorAttr.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('color', colorAttr)
  mat.vertexColors = true
  mat.needsUpdate  = true

  // Large invisible plane used only for raycasting click positions
  groundPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  )
  groundPlane.rotation.x = -Math.PI / 2
  ctx.add(groundPlane)

  infoHud = hud({ position: 'top-left' })
  infoHud.setText('Click scene to place force fields (alternates attractor / repulsor). Max 8.')

  const raycaster = new THREE.Raycaster()

  _onClick = (e) => {
    const rect = ctx.renderer.domElement.getBoundingClientRect()
    const mx   =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    const my   = -((e.clientY - rect.top)  / rect.height) * 2 + 1
    raycaster.setFromCamera({ x: mx, y: my }, ctx.camera)
    const hits = raycaster.intersectObject(groundPlane)
    if (!hits.length) return

    const pt   = hits[0].point
    const type = (fieldToggle++ % 2 === 0) ? 'attractor' : 'repulsor'

    // Evict oldest field when at capacity
    if (fields.length >= MAX_FIELDS) {
      const old = fields.shift()
      old.labelHandle.detach()
      ctx.remove(old.mesh)
      old.mesh.geometry.dispose()
      old.mesh.material.dispose()
    }

    const clr  = type === 'attractor' ? 0x33aaff : 0xff5522
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 14, 10),
      new THREE.MeshStandardMaterial({
        color:       clr,
        emissive:    new THREE.Color(clr).multiplyScalar(0.5),
        transparent: true,
        opacity:     0.9,
      }),
    )
    mesh.position.set(pt.x, 0.5, pt.z)
    ctx.add(mesh)

    const labelHandle = label(
      mesh,
      `${type === 'attractor' ? 'ATTRACT' : 'REPULSE'}  str:${FIELD_STR}`,
      { color: type === 'attractor' ? '#55ccff' : '#ff7744', fontSize: '12px', offsetY: 1.2 },
    )
    fields.push({ mesh, type, labelHandle })
  }

  window.addEventListener('click', _onClick)
}

export function update(ctx, dt) {
  // Apply each field's force before stepping — forceField modifies velocities,
  // which are then consumed by the next world.step() inside particleEmitter.update()
  for (const f of fields) {
    const { x, z } = f.mesh.position
    const len  = Math.sqrt(x * x + z * z) || 1
    const sign = f.type === 'attractor' ? -1 : 1
    forceField(
      pworld,
      particleEmitter.emitterId,
      { x: f.mesh.position.x, y: f.mesh.position.y, z: f.mesh.position.z },
      FIELD_RADIUS,
      { x: sign * x / len * FIELD_STR * dt, y: 0, z: sign * z / len * FIELD_STR * dt },
    )
  }

  particleEmitter.update(ctx.elapsed, dt)

  // Colour particles blue (slow) → red (fast)
  const particles = pworld.getParticles(particleEmitter.emitterId)
  const count     = Math.min(particles.length, MAX_PARTICLES)
  for (let i = 0; i < count; i++) {
    const { velocity: v } = particles[i]
    const spd = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
    const t   = Math.min(1, spd / MAX_SPEED)
    colorBuf[i * 3]     = t
    colorBuf[i * 3 + 1] = 0
    colorBuf[i * 3 + 2] = 1 - t
  }
  colorAttr.needsUpdate = true

  // Pulse and spin each field marker
  for (let i = 0; i < fields.length; i++) {
    const pulse = 0.85 + 0.15 * Math.sin(ctx.elapsed * 3 + i * 1.2)
    fields[i].mesh.scale.setScalar(pulse)
    fields[i].mesh.rotation.y += dt * 1.5
  }
}

export function teardown(ctx) {
  window.removeEventListener('click', _onClick)

  for (const f of fields) {
    f.labelHandle.detach()
    ctx.remove(f.mesh)
    f.mesh.geometry.dispose()
    f.mesh.material.dispose()
  }
  fields = []

  particleEmitter.dispose()

  ctx.remove(groundPlane)
  groundPlane.geometry.dispose()
  groundPlane.material.dispose()

  ctx.remove(ambientLight)
  ctx.remove(ptLight)

  infoHud.dispose()
}

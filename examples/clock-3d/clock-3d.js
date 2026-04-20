// clock-3d.js — Elegant 3D analog clock showing real time
import * as THREE from 'three'
import { sphere, cylinder, torus, mesh } from '../../src/stdlib/geometry.js'

const R    = 3.0   // clock face radius
const TUBE = 0.14  // bezel tube radius

let clockGroup
let hourHandGroup, minuteHandGroup, secondHandGroup
let ambientLight, keyLight

// Creates a hand group pivoted at the clock centre (y=0).
// Body extends toward +y (tip); tail extends toward -y (counterweight).
function makeHand(length, tailLen, radius, color, roughness, metalness, z) {
  const matOpts = { color, roughness, metalness }

  const body = mesh(cylinder(radius, radius, length, 16), matOpts)
  body.position.y = length / 2

  const tail = mesh(cylinder(radius * 0.7, radius * 0.7, tailLen, 16), matOpts)
  tail.position.y = -tailLen / 2

  const grp = new THREE.Group()
  grp.add(body)
  grp.add(tail)
  grp.position.z = z
  return grp
}

export function setup(ctx) {
  ctx.camera.position.set(0, 0, 10)
  ctx.camera.lookAt(0, 0, 0)
  if (ctx.controls) ctx.controls.target.set(0, 0, 0)

  // Warm key light in front + soft amber ambient
  ambientLight = new THREE.AmbientLight(0xffeedd, 0.55)
  keyLight = new THREE.PointLight(0xffd6a0, 2.5, 25)
  keyLight.position.set(1, 2, 8)
  ctx.add(ambientLight)
  ctx.add(keyLight)

  clockGroup = new THREE.Group()

  // Bezel — high-metalness torus ring
  clockGroup.add(mesh(torus(R, TUBE, 16, 96), {
    color: 0xc0c0cc,
    roughness: 0.08,
    metalness: 0.92,
  }))

  // Dark face disc, recessed slightly behind the bezel centre
  const faceMesh = mesh(new THREE.CircleGeometry(R - TUBE * 0.4, 64), {
    color: 0x0f0f18,
    roughness: 0.9,
    metalness: 0.1,
  })
  faceMesh.position.z = -0.01
  clockGroup.add(faceMesh)

  // Hour markers — gold spheres, clockwise from 12 o'clock
  for (let i = 0; i < 12; i++) {
    // angle=π/2 puts i=0 at top; subtract going clockwise
    const angle = Math.PI / 2 - (i / 12) * Math.PI * 2
    const mr    = R - 0.38
    const size  = i === 0 ? 0.13 : 0.09  // 12 o'clock marker is slightly larger
    const m = mesh(sphere(size, 16), { color: 0xffd700, roughness: 0.15, metalness: 0.95 })
    m.position.set(Math.cos(angle) * mr, Math.sin(angle) * mr, 0.06)
    clockGroup.add(m)
  }

  // Minute tick marks — thin radial cylinders, skipping the 12 hour positions
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue
    const angle  = Math.PI / 2 - (i / 60) * Math.PI * 2
    const tickLen = 0.17
    const midR   = R - 0.21
    const t = mesh(cylinder(0.012, 0.012, tickLen, 6), {
      color: 0x777788,
      roughness: 0.5,
      metalness: 0.6,
    })
    t.position.set(Math.cos(angle) * midR, Math.sin(angle) * midR, 0.03)
    // Rotate so the cylinder points radially outward in the face plane
    t.rotation.z = angle - Math.PI / 2
    clockGroup.add(t)
  }

  // Clock hands — pivot at y=0 (clock centre), tip toward +y
  hourHandGroup   = makeHand(1.5,  0.4,  0.085, 0x222233, 0.55, 0.3,  0.08)
  minuteHandGroup = makeHand(2.2,  0.5,  0.052, 0xd0d0e0, 0.25, 0.75, 0.10)
  secondHandGroup = makeHand(2.55, 0.55, 0.020, 0xff2020, 0.45, 0.2,  0.12)

  clockGroup.add(hourHandGroup)
  clockGroup.add(minuteHandGroup)
  clockGroup.add(secondHandGroup)

  // Gold centre cap covers the hand pivots
  const cap = mesh(sphere(0.11, 16), { color: 0xffd700, roughness: 0.15, metalness: 0.95 })
  cap.position.z = 0.15
  clockGroup.add(cap)

  ctx.add(clockGroup)
}

export function update(ctx, dt) {
  const now = new Date()
  const h   = now.getHours() % 12
  const m   = now.getMinutes()
  const s   = now.getSeconds()
  const ms  = now.getMilliseconds()

  // Smooth (continuous) hand angles — negative = clockwise in Three.js
  const smoothS = s + ms / 1000
  const smoothM = m + smoothS / 60
  const smoothH = h + smoothM / 60

  secondHandGroup.rotation.z = -(smoothS / 60) * Math.PI * 2
  minuteHandGroup.rotation.z = -(smoothM / 60) * Math.PI * 2
  hourHandGroup.rotation.z   = -(smoothH / 12) * Math.PI * 2
}

export function teardown(ctx) {
  ctx.remove(clockGroup)
  ctx.remove(ambientLight)
  ctx.remove(keyLight)
}

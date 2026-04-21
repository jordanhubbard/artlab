// strange-attractor.js — Lorenz butterfly attractor with animated vertex-colored trail
import * as THREE from 'three'

const MAX_POINTS = 6000
const SCALE = 0.3
const DT = 0.005
const PTS_PER_FRAME = 20
const SIGMA = 10, RHO = 28, BETA = 8 / 3

// Lorenz integration state
let lx, ly, lz
let pointCount, phase, followIndex

// Scene objects (kept for teardown)
let trailGeo, trailMat, trailLine
let followerMesh, followerLight, ambientLight, axesHelper

// Pre-allocated typed arrays
let posArray, colArray

export async function setup(ctx) {
  lx = 0.1; ly = 0; lz = 0
  pointCount = 0; phase = 'growing'; followIndex = 0

  // Slightly above and angled to see both lobes of the butterfly
  ctx.camera.position.set(10, 6, 20)
  if (ctx.controls?.target) ctx.controls.target.set(0, 0, 0)

  ctx.setBloom(1.4)

  ambientLight = new THREE.AmbientLight(0x080818, 1.0)
  ctx.add(ambientLight)

  // Skip the initial transient so the path starts on the attractor
  for (let i = 0; i < 250; i++) {
    const dx = SIGMA * (ly - lx), dy = lx * (RHO - lz) - ly, dz = lx * ly - BETA * lz
    lx += dx * DT; ly += dy * DT; lz += dz * DT
  }

  posArray = new Float32Array(MAX_POINTS * 3)
  colArray = new Float32Array(MAX_POINTS * 3)

  trailGeo = new THREE.BufferGeometry()
  trailGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
  trailGeo.setAttribute('color',    new THREE.BufferAttribute(colArray,  3))
  trailGeo.setDrawRange(0, 0)

  trailMat = new THREE.LineBasicMaterial({ vertexColors: true })
  trailLine = new THREE.Line(trailGeo, trailMat)
  ctx.add(trailLine)

  // Faint coordinate axes for spatial reference
  axesHelper = new THREE.AxesHelper(4)
  axesHelper.material.opacity = 0.12
  axesHelper.material.transparent = true
  ctx.add(axesHelper)

  // Glowing sphere — hidden until the full attractor is traced
  followerMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(1, 1, 1),
      emissiveIntensity: 4.0,
      roughness: 0.0,
      metalness: 0.0,
    })
  )
  followerMesh.visible = false
  ctx.add(followerMesh)

  // Point light travels with the sphere for extra glow
  followerLight = new THREE.PointLight(0xffffff, 3.0, 10)
  followerLight.visible = false
  ctx.add(followerLight)
}

export function update(ctx, dt) {
  if (phase === 'growing') {
    const toAdd = Math.min(PTS_PER_FRAME, MAX_POINTS - pointCount)

    for (let i = 0; i < toAdd; i++) {
      // Lorenz derivatives at current position
      const dx = SIGMA * (ly - lx)
      const dy = lx * (RHO - lz) - ly
      const dz = lx * ly - BETA * lz
      const speed = Math.sqrt(dx * dx + dy * dy + dz * dz)

      // Euler step
      lx += dx * DT; ly += dy * DT; lz += dz * DT

      // Velocity → color: slow=blue/purple, mid=hot pink, fast=orange
      // Lorenz speeds range roughly 0–22 in these coords
      const t = Math.min(1, speed / 22)
      let r, g, b
      if (t < 0.33) {
        const s = t / 0.33
        r = 0.15 + s * 0.35; g = 0;     b = 1
      } else if (t < 0.66) {
        const s = (t - 0.33) / 0.33
        r = 0.5 + s * 0.5;   g = 0;     b = 1 - s * 0.7
      } else {
        const s = (t - 0.66) / 0.34
        r = 1;                g = s * 0.55; b = 0.3 - s * 0.3
      }

      // Map Lorenz coords → scene:
      //   lx [-20..20]  → THREE x
      //   lz [0..50], center ~25 → THREE y
      //   ly [-30..30]  → THREE z
      const i3 = pointCount * 3
      posArray[i3]     = lx * SCALE
      posArray[i3 + 1] = (lz - 25) * SCALE
      posArray[i3 + 2] = ly * SCALE
      colArray[i3]     = r; colArray[i3 + 1] = g; colArray[i3 + 2] = b
      pointCount++
    }

    trailGeo.attributes.position.needsUpdate = true
    trailGeo.attributes.color.needsUpdate = true
    trailGeo.setDrawRange(0, pointCount)

    if (pointCount >= MAX_POINTS) {
      phase = 'following'
      followerMesh.visible = true
      followerLight.visible = true
    }
  } else {
    // Sphere traces the stored attractor path, 3 path-vertices per frame
    followIndex = (followIndex + 3) % MAX_POINTS
    const i3 = followIndex * 3

    followerMesh.position.set(posArray[i3], posArray[i3 + 1], posArray[i3 + 2])
    followerLight.position.copy(followerMesh.position)

    // Tint the sphere and light to match the path color at this point
    const r = colArray[i3], g = colArray[i3 + 1], b = colArray[i3 + 2]
    followerMesh.material.emissive.setRGB(r, g, b)
    followerLight.color.setRGB(r, g, b)
  }
}

export function teardown(ctx) {
  ctx.remove(ambientLight)
  ctx.remove(trailLine)
  ctx.remove(axesHelper)
  ctx.remove(followerMesh)
  ctx.remove(followerLight)
  trailGeo.dispose()
  trailMat.dispose()
}

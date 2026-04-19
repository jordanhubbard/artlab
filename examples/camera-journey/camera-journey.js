// Camera Journey — a 3x3 grid of glowing pillars toured by a PathCamera; press C to toggle OrbitControls.

import * as THREE from 'three'
import { PathCamera } from '../../src/stdlib/cameras.js'

const PILLAR_COLORS = [
  0xff4466, 0xff8800, 0xffdd00,
  0x44ff88, 0x00ddff, 0x4466ff,
  0xaa44ff, 0xff44cc, 0x00ffaa,
]

function buildCurvePath() {
  const R = 7, dip = 1.5
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3( R,  4,  0),
    new THREE.Vector3( R,  3,  R),
    new THREE.Vector3( 0, dip,  R),
    new THREE.Vector3(-R,  3,  R),
    new THREE.Vector3(-R,  4,  0),
    new THREE.Vector3(-R,  3, -R),
    new THREE.Vector3( 0, dip, -R),
    new THREE.Vector3( R,  3, -R),
  ], true)
}

export function setup(ctx) {
  const { THREE: T, scene } = ctx

  ctx.setBloom(0.7)
  ctx.add(new THREE.AmbientLight(0x111122, 1.0))

  ctx._pillars = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col
      const color = PILLAR_COLORS[idx]
      const geo = new THREE.BoxGeometry(0.4, 5, 0.4)
      const mat = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.6, roughness: 1 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set((col - 1) * 3, 2.5, (row - 1) * 3)
      ctx.add(mesh)
      ctx._pillars.push(mesh)
    }
  }

  const curve = buildCurvePath()
  ctx._pathCam = PathCamera(curve, { speed: 1 / 30, fov: 65 })
  ctx._useOrbit = false

  ctx._onKey = (e) => {
    if (e.key === 'c' || e.key === 'C') {
      ctx._useOrbit = !ctx._useOrbit
      ctx.controls.enabled = ctx._useOrbit
    }
  }
  window.addEventListener('keydown', ctx._onKey)
  ctx.controls.enabled = false
  ctx.camera.position.set(7, 4, 0)
}

export function update(ctx, dt) {
  const t = ctx.elapsed

  for (let i = 0; i < ctx._pillars.length; i++) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.8 + i * 0.9)
    ctx._pillars[i].material.emissiveIntensity = 0.3 + 0.7 * pulse
  }

  if (!ctx._useOrbit) {
    ctx._pathCam.update(dt)
    ctx.camera.position.copy(ctx._pathCam.camera.position)
    ctx.camera.quaternion.copy(ctx._pathCam.camera.quaternion)
  }
}

export function teardown(ctx) {
  window.removeEventListener('keydown', ctx._onKey)
  for (const p of ctx._pillars) {
    p.geometry.dispose()
    p.material.dispose()
    ctx.remove(p)
  }
}

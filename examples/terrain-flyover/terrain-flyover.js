// terrain-flyover.js — procedural terrain with altitude vertex colors and spline camera flyover
import * as THREE from 'three'

let _terrain, _sun, _ambient, _spline, _cameraT

// Multi-octave sin/cos noise — no external deps
function noise2d(x, z) {
  return (
    Math.cos(x * 0.15 + z * 0.12) * 6.0 +  // broad valleys / ridges
    Math.cos(x * 0.40 - z * 0.30) * 3.0 +  // mid-scale hills
    Math.sin(x * 0.30 + z * 0.20) * 4.0 +  // large rolling shapes
    Math.sin(x * 0.70 - z * 0.50) * 2.0 +  // medium detail
    Math.sin(x * 1.50 + z * 1.20) * 0.8 +  // small bumps
    Math.sin(x * 3.00 - z * 2.50) * 0.3    // surface roughness
  )
}

function altitudeColor(h) {
  if (h < -1.0) return new THREE.Color(0x1a3a6e)  // deep water
  if (h <  2.0) return new THREE.Color(0x2d6a2d)  // grass
  if (h <  6.0) return new THREE.Color(0x7a5c3a)  // rock
  return               new THREE.Color(0xeef0f5)  // snow
}

export async function setup(ctx) {
  ctx.camera.position.set(-85, 22, -55)

  // ── Terrain geometry ──────────────────────────────────────────────────────
  const geo = new THREE.PlaneGeometry(200, 200, 200, 200)
  const pos = geo.attributes.position

  // PlaneGeometry lies in XY plane (z=0). After mesh.rotation.x = -PI/2:
  //   local X  → world X (unchanged)
  //   local Y  → world -Z
  //   local Z  → world Y (height)
  // So we displace local Z using noise(localX, -localY).
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i)
    const wz = -pos.getY(i)
    pos.setZ(i, noise2d(wx, wz))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()

  // Vertex colors by altitude (local Z = world height after rotation)
  const colArr = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const c = altitudeColor(pos.getZ(i))
    colArr[i * 3]     = c.r
    colArr[i * 3 + 1] = c.g
    colArr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3))

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.0,
  })

  _terrain = new THREE.Mesh(geo, mat)
  _terrain.rotation.x = -Math.PI / 2
  ctx.add(_terrain)

  // ── Lighting ──────────────────────────────────────────────────────────────
  _sun = new THREE.DirectionalLight(0xfff4d6, 1.4)
  _sun.position.set(80, 120, 60)
  ctx.add(_sun)

  _ambient = new THREE.AmbientLight(0x5577aa, 0.45)
  ctx.add(_ambient)

  // ── Atmosphere ────────────────────────────────────────────────────────────
  ctx.scene.fog = new THREE.FogExp2(0x89b3cc, 0.008)

  // ── Camera spline ─────────────────────────────────────────────────────────
  // Path swoops over mountains and dips into valleys for a cinematic feel
  _spline = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-85, 22, -55),
    new THREE.Vector3(-35, 16, -85),
    new THREE.Vector3( 15, 28, -50),
    new THREE.Vector3( 60, 20,  -5),
    new THREE.Vector3( 80, 25,  45),
    new THREE.Vector3( 30, 15,  82),
    new THREE.Vector3(-25, 22,  82),
    new THREE.Vector3(-75, 18,  42),
  ], true)  // closed loop

  _cameraT = 0
}

export function update(ctx, dt) {
  _cameraT = (_cameraT + dt * 0.008) % 1.0

  const p = _spline.getPoint(_cameraT)
  const aheadT = (_cameraT + 0.02) % 1.0
  const look = _spline.getPoint(aheadT)

  ctx.camera.position.set(p.x, p.y, p.z)
  ctx.camera.lookAt(look.x, look.y - 4, look.z)  // tilt gaze slightly down
}

export function teardown(ctx) {
  ctx.remove(_terrain)
  ctx.remove(_sun)
  ctx.remove(_ambient)
  ctx.scene.fog = null
}

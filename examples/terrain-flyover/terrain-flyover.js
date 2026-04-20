// terrain-flyover — infinite procedural terrain with noise displacement and a forward-flying camera.
import * as Three from 'three'
import { noise2 } from '../../src/stdlib/math.js'

const SEGS = 128
const SIZE = 80

function sampleHeight(x, z, offset) {
  const sx = x * 0.07 + offset
  const sz = z * 0.07
  return (
    noise2(sx,           sz          ) * 3.2 +
    noise2(sx * 2.1,     sz * 2.1    ) * 1.4 +
    noise2(sx * 4.5,     sz * 4.5    ) * 0.55 +
    noise2(sx * 9.8,     sz * 9.8    ) * 0.18
  )
}

function altColor(y) {
  if (y < -1.0) return [0.06, 0.15, 0.55]          // deep water
  if (y <  0.0) {
    const t = (y + 1.0)
    return [0.72 - t * 0.3, 0.62 - t * 0.1, 0.30 + t * 0.1]  // sandy shore
  }
  if (y <  2.0) {
    const t = y / 2.0
    return [0.18 - t * 0.07, 0.45 + t * 0.08, 0.14]            // green lowlands
  }
  if (y <  4.0) {
    const t = (y - 2.0) / 2.0
    return [0.38 + t * 0.12, 0.28 - t * 0.12, 0.15]            // brown mountains
  }
  const t = Math.min(1, (y - 4.0) / 2.0)
  return [0.78 + t * 0.22, 0.78 + t * 0.22, 0.78 + t * 0.22]  // snow
}

function displace(geo, offset) {
  const pos = geo.attributes.position
  const col = geo.attributes.color

  for (let i = 0, n = pos.count; i < n; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = sampleHeight(x, z, offset)
    pos.setY(i, y)
    const [r, g, b] = altColor(y)
    col.setXYZ(i, r, g, b)
  }
  pos.needsUpdate = true
  col.needsUpdate = true
  geo.computeVertexNormals()
}

export function setup(ctx) {
  ctx.setBloom(0.3)

  ctx.scene.fog = new Three.FogExp2(0x0a1020, 0.022)
  if (ctx.renderer.setClearColor) ctx.renderer.setClearColor(0x0a1020, 1)

  const sun = new Three.DirectionalLight(0xffd080, 1.8)
  sun.position.set(30, 50, -20)
  ctx.add(sun)

  const sky = new Three.AmbientLight(0x102040, 1.2)
  ctx.add(sky)

  ctx._lights = [sun, sky]

  // Build terrain geometry (PlaneGeometry, rotated to XZ floor)
  const geo = new Three.PlaneGeometry(SIZE, SIZE, SEGS, SEGS)
  geo.rotateX(-Math.PI / 2)

  // Add vertex color attribute
  const count = geo.attributes.position.count
  const colors = new Float32Array(count * 3)
  geo.setAttribute('color', new Three.BufferAttribute(colors, 3))

  const mat = new Three.MeshStandardMaterial({
    vertexColors: true,
    roughness:    0.88,
    metalness:    0.0,
  })

  ctx._terrain = new Three.Mesh(geo, mat)
  ctx.add(ctx._terrain)

  ctx._offset  = 0
  ctx._camT    = 0

  ctx.camera.position.set(0, 8, 20)
  ctx.camera.lookAt(0, 3, 5)
  if (ctx.controls) ctx.controls.enabled = false

  displace(geo, 0)
}

export function update(ctx, dt) {
  const speed = 5.0
  ctx._offset += speed * dt * 0.07
  ctx._camT   += dt

  displace(ctx._terrain.geometry, ctx._offset)

  // Gentle lateral sway
  const sway = Math.sin(ctx._camT * 0.25) * 3.5
  ctx.camera.position.set(sway, 8, 20)
  ctx.camera.lookAt(sway * 0.4, 3, 5)
}

export function teardown(ctx) {
  ctx.remove(ctx._terrain)
  for (const l of ctx._lights) ctx.remove(l)
  ctx.scene.fog = null
  if (ctx.controls) ctx.controls.enabled = true
}

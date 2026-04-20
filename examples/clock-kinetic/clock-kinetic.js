// clock-kinetic — kinetic wall clock with cylinder hands showing real time.
// Three rings for hours/minutes/seconds; highlighted "hand" sphere per ring.
import * as Three from 'three'

const HOUR_R   = 3.0
const MIN_R    = 4.3
const SEC_R    = 5.5

function makeRing(ctx, count, radius, baseColor, handColor, handScale, sphereR) {
  const geo = new Three.SphereGeometry(sphereR, 12, 8)
  const group = new Three.Group()
  const spheres = []

  for (let i = 0; i < count; i++) {
    const isHand = i === 0
    const mat = new Three.MeshStandardMaterial({
      color:             isHand ? handColor : baseColor,
      emissive:          new Three.Color(isHand ? handColor : baseColor).multiplyScalar(0.4),
      roughness:         0.3,
      metalness:         0.5,
    })
    const mesh = new Three.Mesh(geo, mat)
    const angle = (i / count) * Math.PI * 2
    mesh.position.set(Math.sin(angle) * radius, Math.cos(angle) * radius, 0)
    if (isHand) mesh.scale.setScalar(handScale)
    group.add(mesh)
    spheres.push(mesh)
  }

  ctx.add(group)
  ctx._objects.push(group)
  return { group, spheres }
}

export function setup(ctx) {
  ctx.camera.position.set(0, 0, 12)
  ctx.setBloom(1.0)

  const ambient = new Three.AmbientLight(0x0a0a1a, 1.0)
  ctx.add(ambient)

  const pt = new Three.PointLight(0xffffff, 2.0, 40)
  pt.position.set(0, 0, 10)
  ctx.add(pt)

  ctx._objects = [ambient, pt]

  // Hour markers — warm gold
  ctx._hourRing = makeRing(ctx, 12, HOUR_R, 0x886622, 0xffcc44, 1.6, 0.18)
  // Minute markers — cool blue
  ctx._minRing  = makeRing(ctx, 60, MIN_R,  0x223366, 0x88aaff, 1.5, 0.10)
  // Second markers — hot pink
  ctx._secRing  = makeRing(ctx, 60, SEC_R,  0x441133, 0xff2299, 1.4, 0.09)

  // Center cap
  const capGeo = new Three.SphereGeometry(0.25, 16, 12)
  const capMat = new Three.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.1 })
  const cap = new Three.Mesh(capGeo, capMat)
  ctx.add(cap)
  ctx._objects.push(cap)
}

export function update(ctx, dt) {
  const now = new Date()
  const h = now.getHours() % 12
  const m = now.getMinutes()
  const s = now.getSeconds() + now.getMilliseconds() / 1000

  // Rotate each ring so that index-0 (hand sphere) points to correct position
  // negative rotation because 12 o'clock is +Y and we go clockwise
  ctx._hourRing.group.rotation.z = -((h + m / 60) / 12) * Math.PI * 2
  ctx._minRing.group.rotation.z  = -((m + s / 60) / 60) * Math.PI * 2
  ctx._secRing.group.rotation.z  = -(s / 60) * Math.PI * 2
}

export function teardown(ctx) {
  for (const obj of ctx._objects) ctx.remove(obj)
}

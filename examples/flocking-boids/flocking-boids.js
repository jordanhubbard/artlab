// flocking-boids — 80 cone boids with classic Reynolds separation/alignment/cohesion.
import * as Three from 'three'

const N       = 80
const BOUNDS  = 15
const SEP_R   = 1.2
const ALI_R   = 3.0
const COH_R   = 3.5
const MAX_SPD = 7.0
const MIN_SPD = 2.0
const SEP_W   = 1.8
const ALI_W   = 1.0
const COH_W   = 0.7

function wrapScalar(v, lo, hi) {
  const range = hi - lo
  if (v > hi) return v - range
  if (v < lo) return v + range
  return v
}

function speedColor(speed) {
  // blue (slow) → red (fast)
  const t = Math.min(1, Math.max(0, (speed - MIN_SPD) / (MAX_SPD - MIN_SPD)))
  const r = Math.floor(t * 255)
  const b = Math.floor((1 - t) * 220)
  return (r << 16) | (b & 0xff)
}

export function setup(ctx) {
  ctx.camera.position.set(0, 10, 30)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(0.5)

  const ambient = new Three.AmbientLight(0x223355, 1.5)
  ctx.add(ambient)
  const dir = new Three.DirectionalLight(0xffffff, 1.2)
  dir.position.set(10, 20, 15)
  ctx.add(dir)

  // Cone pointing +Z (forward direction after rotateX)
  const coneGeo = new Three.ConeGeometry(0.18, 0.55, 8)
  coneGeo.rotateX(Math.PI / 2)

  ctx._boids = []
  ctx._boidLights = [ambient, dir]

  for (let i = 0; i < N; i++) {
    const mat = new Three.MeshStandardMaterial({
      color: speedColor(MIN_SPD + (MAX_SPD - MIN_SPD) * 0.3),
      roughness: 0.5,
      metalness: 0.3,
    })
    const cone = new Three.Mesh(coneGeo, mat)

    // Scatter initial positions
    cone.position.set(
      (Math.random() * 2 - 1) * BOUNDS * 0.7,
      (Math.random() * 2 - 1) * BOUNDS * 0.5,
      (Math.random() * 2 - 1) * BOUNDS * 0.7,
    )

    const speed = MIN_SPD + Math.random() * (MAX_SPD - MIN_SPD) * 0.4
    const phi   = Math.random() * Math.PI * 2
    const theta = (Math.random() - 0.5) * 0.4
    cone.userData.vel = new Three.Vector3(
      Math.cos(phi) * Math.cos(theta) * speed,
      Math.sin(theta) * speed,
      Math.sin(phi) * Math.cos(theta) * speed,
    )

    ctx.add(cone)
    ctx._boids.push(cone)
  }
}

const _steer = new Three.Vector3()
const _sep   = new Three.Vector3()
const _ali   = new Three.Vector3()
const _coh   = new Three.Vector3()
const _diff  = new Three.Vector3()
const _fwd   = new Three.Vector3(0, 0, 1)

export function update(ctx, dt) {
  const dt_ = Math.min(dt, 0.05)

  for (let i = 0; i < ctx._boids.length; i++) {
    const boid = ctx._boids[i]
    const pos  = boid.position
    const vel  = boid.userData.vel

    _sep.set(0, 0, 0)
    _ali.set(0, 0, 0)
    _coh.set(0, 0, 0)
    let sepN = 0, aliN = 0, cohN = 0

    for (let j = 0; j < ctx._boids.length; j++) {
      if (i === j) continue
      const other = ctx._boids[j]
      const d = pos.distanceTo(other.position)

      if (d < SEP_R && d > 1e-4) {
        _diff.subVectors(pos, other.position).divideScalar(d * d)
        _sep.add(_diff)
        sepN++
      }
      if (d < ALI_R) { _ali.add(other.userData.vel); aliN++ }
      if (d < COH_R) { _coh.add(other.position);     cohN++ }
    }

    _steer.set(0, 0, 0)
    if (sepN > 0) _steer.addScaledVector(_sep.divideScalar(sepN), SEP_W)
    if (aliN > 0) _steer.add(_ali.divideScalar(aliN).sub(vel).multiplyScalar(ALI_W))
    if (cohN > 0) _steer.add(_coh.divideScalar(cohN).sub(pos).multiplyScalar(COH_W))

    vel.addScaledVector(_steer, dt_)

    const spd = vel.length()
    if (spd > MAX_SPD) vel.multiplyScalar(MAX_SPD / spd)
    else if (spd < MIN_SPD && spd > 1e-4) vel.multiplyScalar(MIN_SPD / spd)

    pos.addScaledVector(vel, dt_)
    pos.x = wrapScalar(pos.x, -BOUNDS, BOUNDS)
    pos.y = wrapScalar(pos.y, -BOUNDS * 0.6, BOUNDS * 0.6)
    pos.z = wrapScalar(pos.z, -BOUNDS, BOUNDS)

    // Orient toward velocity
    const s = vel.length()
    if (s > 1e-3) boid.quaternion.setFromUnitVectors(_fwd, vel.clone().normalize())

    boid.material.color.setHex(speedColor(s))
  }
}

export function teardown(ctx) {
  for (const boid of ctx._boids) ctx.remove(boid)
  for (const l of ctx._boidLights) ctx.remove(l)
}

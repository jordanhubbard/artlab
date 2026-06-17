// marble-run — spiral ramps, platforms, and marbles with simple physics.
import * as Three from 'three'

const GRAVITY = -15
const BOUNCE = 0.55
const RAMP_BOUNCE = 0.02
const FRICTION = 0.985
const RAMP_EDGE_RELEASE = 0.65
const RAMP_TOP_TOLERANCE = 0.03
const MAX_MARBLES = 30
const SPAWN_INTERVAL = 1.2
const MAX_MODEL_TILT = 0.35
const TILT_STEP = 0.04
const COLLECTION_Y = -2.95

// Ramp segment: start/end + normal for collision
function buildRamps() {
  const ramps = []

  // Alternating catch ramps: each plate sits under the previous exit.
  const levels = [
    { x1: -3.4, x2:  2.6, y:  5.0,  tilt: -0.115 },
    { x1: -3.2, x2:  4.5, y:  3.55, tilt:  0.11 },
    { x1: -4.5, x2:  3.2, y:  2.1,  tilt: -0.11 },
    { x1: -3.3, x2:  4.5, y:  0.65, tilt:  0.105 },
    { x1: -4.5, x2:  3.3, y: -0.8,  tilt: -0.105 },
    { x1: -3.5, x2:  4.1, y: -2.25, tilt:  0.10 },
  ]

  for (const l of levels) {
    const length = Math.abs(l.x2 - l.x1)
    ramps.push({
      cx: (l.x1 + l.x2) / 2,
      cy: l.y,
      cz: 0,
      width: length,
      depth: 1.42,
      tilt: l.tilt,
      minX: Math.min(l.x1, l.x2),
      maxX: Math.max(l.x1, l.x2),
    })
  }
  return ramps
}

function buildRampMeshes(ramps) {
  const meshes = []
  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i]
    const geo = new Three.BoxGeometry(r.width, 0.12, r.depth)
    const hue = i / ramps.length * 0.6
    const mat = new Three.MeshStandardMaterial({
      color: new Three.Color().setHSL(hue, 0.5, 0.45),
      roughness: 0.6, metalness: 0.2,
    })
    const mesh = new Three.Mesh(geo, mat)
    mesh.position.set(r.cx, r.cy, r.cz)
    mesh.rotation.z = r.tilt
    meshes.push(mesh)
  }
  return meshes
}

class Marble {
  constructor(x, y, z, hue) {
    this.pos = new Three.Vector3(x, y, z)
    this.vel = new Three.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.3)
    this.radius = 0.16 + Math.random() * 0.06
    this.hue = hue
    this.mesh = null
    this.alive = true
  }
}

function createMarbleMesh(marble) {
  const geo = new Three.SphereGeometry(marble.radius, 16, 12)
  const mat = new Three.MeshStandardMaterial({
    color: new Three.Color().setHSL(marble.hue, 0.8, 0.55),
    roughness: 0.15, metalness: 0.8,
  })
  return new Three.Mesh(geo, mat)
}

function rampSurfaceY(ramp, x) {
  return ramp.cy + (x - ramp.cx) * Math.sin(ramp.tilt) + 0.06
}

function rampNormal(ramp) {
  const slope = Math.sin(ramp.tilt)
  return new Three.Vector3(-slope, 1, 0).normalize()
}

function localGravity(ctx) {
  const g = new Three.Vector3(0, GRAVITY, 0)
  if (!ctx._model) return g
  ctx._model.updateMatrixWorld()
  return g.applyQuaternion(ctx._model.quaternion.clone().invert())
}

function setModelTilt(ctx, x, z) {
  ctx._modelTiltX = Math.max(-MAX_MODEL_TILT, Math.min(MAX_MODEL_TILT, x))
  ctx._modelTiltZ = Math.max(-MAX_MODEL_TILT, Math.min(MAX_MODEL_TILT, z))
  ctx._model.rotation.x = ctx._modelTiltX
  ctx._model.rotation.z = ctx._modelTiltZ
  updateTiltHud(ctx)
}

function updateTiltHud(ctx) {
  if (!ctx._tiltHud) return
  const x = Math.round(Three.MathUtils.radToDeg(ctx._modelTiltX ?? 0))
  const z = Math.round(Three.MathUtils.radToDeg(ctx._modelTiltZ ?? 0))
  ctx._tiltHud.textContent = `Tilt X ${x}°   Tilt Z ${z}°`
}

function collideWithRamps(marble, ramps) {
  for (const r of ramps) {
    // Check if marble is above this ramp
    const mx = marble.pos.x
    const my = marble.pos.y
    const edgeRelease = marble.radius * RAMP_EDGE_RELEASE
    if (mx < r.minX + edgeRelease || mx > r.maxX - edgeRelease) continue

    // Ramp surface Y at marble's X (accounting for tilt)
    const surfaceY = rampSurfaceY(r, mx) // half thickness included

    const distanceAboveSurface = my - surfaceY
    if (
      distanceAboveSurface < marble.radius &&
      distanceAboveSurface > -RAMP_TOP_TOLERANCE &&
      Math.abs(marble.pos.z) < r.depth / 2 + marble.radius
    ) {
      marble.pos.y = surfaceY + marble.radius
      const normal = rampNormal(r)
      const normalSpeed = marble.vel.dot(normal)
      if (normalSpeed < 0) {
        const bounce = Math.abs(normalSpeed) < 0.65 ? 0 : RAMP_BOUNCE
        marble.vel.addScaledVector(normal, -(1 + bounce) * normalSpeed)
      }
      marble.vel.x *= FRICTION
      marble.vel.z *= FRICTION
    }
  }
}

export function setup(ctx) {
  ctx.setHelp('Arrow keys: tilt model   •   R: reset tilt   •   Drag: orbit camera')
  ctx.camera.position.set(0, 2.2, 12.8)
  ctx.camera.lookAt(0, 1.05, 0)
  ctx.setBloom(0.3)

  const ambient = new Three.AmbientLight(0x556677, 0.8)
  ctx.add(ambient)
  const sun = new Three.DirectionalLight(0xffffff, 1.3)
  sun.position.set(5, 10, 8)
  ctx.add(sun)
  const fill = new Three.DirectionalLight(0x4488cc, 0.4)
  fill.position.set(-5, 5, -3)
  ctx.add(fill)
  ctx._lights = [ambient, sun, fill]

  ctx._model = new Three.Group()
  ctx.add(ctx._model)
  ctx._modelTiltX = 0
  ctx._modelTiltZ = 0

  ctx._ramps = buildRamps()
  ctx._rampMeshes = buildRampMeshes(ctx._ramps)
  for (const m of ctx._rampMeshes) ctx._model.add(m)

  // Collection bowl at the bottom
  const bowlGeo = new Three.CylinderGeometry(2.35, 1.55, 0.48, 24, 1, true)
  const bowlMat = new Three.MeshStandardMaterial({
    color: 0x666688, side: Three.DoubleSide, roughness: 0.3, metalness: 0.5,
  })
  ctx._bowl = new Three.Mesh(bowlGeo, bowlMat)
  ctx._bowl.position.set(-2.85, COLLECTION_Y - 0.05, 0)
  ctx._model.add(ctx._bowl)

  const container = ctx.renderer.domElement.parentElement
  if (container) {
    container.style.position = 'relative'
    const hud = document.createElement('div')
    hud.id = 'marble-tilt-hud'
    hud.style.cssText =
      'position:absolute;bottom:14px;left:14px;z-index:10;pointer-events:none;' +
      'font-family:"Courier New",monospace;font-size:10px;letter-spacing:0.14em;' +
      'text-transform:uppercase;color:rgba(180,220,255,0.64);' +
      'background:rgba(2,8,20,0.32);border:1px solid rgba(110,170,255,0.12);' +
      'padding:7px 9px;border-radius:2px'
    container.appendChild(hud)
    ctx._tiltHud = hud
  }
  updateTiltHud(ctx)

  ctx._onTiltKey = (e) => {
    if (e.key === 'ArrowLeft') {
      setModelTilt(ctx, ctx._modelTiltX, ctx._modelTiltZ + TILT_STEP)
    } else if (e.key === 'ArrowRight') {
      setModelTilt(ctx, ctx._modelTiltX, ctx._modelTiltZ - TILT_STEP)
    } else if (e.key === 'ArrowUp') {
      setModelTilt(ctx, ctx._modelTiltX - TILT_STEP, ctx._modelTiltZ)
    } else if (e.key === 'ArrowDown') {
      setModelTilt(ctx, ctx._modelTiltX + TILT_STEP, ctx._modelTiltZ)
    } else if (e.key === 'r' || e.key === 'R') {
      setModelTilt(ctx, 0, 0)
    } else {
      return
    }
    e.preventDefault()
  }
  window.addEventListener('keydown', ctx._onTiltKey)

  ctx._marbles = []
  ctx._spawnTimer = 0
  ctx._marbleIndex = 0
}

export function update(ctx, dt) {
  const dt_ = Math.min(dt, 0.03)
  const gravity = localGravity(ctx)

  // Spawn marbles
  ctx._spawnTimer += dt_
  if (ctx._spawnTimer > SPAWN_INTERVAL && ctx._marbles.length < MAX_MARBLES) {
    ctx._spawnTimer = 0
    const hue = (ctx._marbleIndex * 0.13) % 1
    const entry = ctx._ramps[0]
    const marble = new Marble(entry.minX + 0.65 + Math.random() * 0.35, 6.6, (Math.random() - 0.5) * 0.22, hue)
    marble.mesh = createMarbleMesh(marble)
    marble.mesh.position.copy(marble.pos)
    ctx._model.add(marble.mesh)
    ctx._marbles.push(marble)
    ctx._marbleIndex++
  }

  // Simulate
  for (const m of ctx._marbles) {
    if (!m.alive) continue

    m.vel.addScaledVector(gravity, dt_)
    m.pos.addScaledVector(m.vel, dt_)

    collideWithRamps(m, ctx._ramps)

    // Floor / bowl collision
    if (m.pos.y - m.radius < COLLECTION_Y) {
      m.pos.y = COLLECTION_Y + m.radius
      m.vel.y *= -BOUNCE * 0.5
      m.vel.x *= 0.92
      m.vel.z *= 0.92
      if (Math.abs(m.vel.y) < 0.1) m.vel.y = 0
    }

    // Kill if too far
    if (m.pos.y < -10) m.alive = false

    m.mesh.position.copy(m.pos)
    // Roll rotation
    m.mesh.rotation.x += m.vel.z * dt_ * 5
    m.mesh.rotation.z -= m.vel.x * dt_ * 5
  }

  // Remove dead marbles
  ctx._marbles = ctx._marbles.filter(m => {
    if (!m.alive) {
      m.mesh.parent?.remove(m.mesh)
      m.mesh.geometry.dispose()
      m.mesh.material.dispose()
    }
    return m.alive
  })
}

export function teardown(ctx) {
  if (ctx._onTiltKey) window.removeEventListener('keydown', ctx._onTiltKey)
  ctx._tiltHud?.remove()
  for (const m of ctx._rampMeshes) {
    m.parent?.remove(m)
    m.geometry.dispose()
    m.material.dispose()
  }
  ctx._bowl.parent?.remove(ctx._bowl)
  ctx._bowl.geometry.dispose()
  ctx._bowl.material.dispose()
  for (const m of ctx._marbles) {
    m.mesh.parent?.remove(m.mesh)
    m.mesh.geometry.dispose()
    m.mesh.material.dispose()
  }
  if (ctx._model) ctx.remove(ctx._model)
  for (const l of ctx._lights) ctx.remove(l)
}

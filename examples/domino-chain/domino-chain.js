// domino-chain — 20 physics dominoes in a curved path; click the first to topple.
import * as Three from 'three'
import { body, integrate, gravityForce, applyForce, applyImpulse } from '../../src/physics/Physics.js'

const COUNT    = 20
const DOM_W    = 0.3
const DOM_H    = 1.4
const DOM_D    = 0.08
const SPACING  = 0.9
const GROUND_Y = 0.0
const G        = 9.0
const DAMPING  = 0.92
const FRICTION = 0.85

function buildDominoes(ctx) {
  const geo = new Three.BoxGeometry(DOM_W, DOM_H, DOM_D)
  const dominoes = []

  for (let i = 0; i < COUNT; i++) {
    const t      = i / (COUNT - 1)
    const angle  = t * Math.PI * 1.2 - Math.PI * 0.1
    const cx     = Math.cos(angle) * 4
    const cz     = Math.sin(angle) * 4
    const facing = angle + Math.PI / 2

    const mat = new Three.MeshStandardMaterial({
      color:     new Three.Color().setHSL(t, 0.7, 0.5),
      roughness: 0.6,
      metalness: 0.2,
    })
    const mesh = new Three.Mesh(geo, mat)
    mesh.position.set(cx, GROUND_Y + DOM_H / 2, cz)
    mesh.rotation.y = facing
    ctx.add(mesh)

    const phys = body({
      position: new Three.Vector3(cx, GROUND_Y + DOM_H / 2, cz),
      mass: 1.0,
    })
    phys._mesh   = mesh
    phys._facing = facing
    phys._tilt   = 0
    phys._angVel = 0
    phys._fallen = false
    phys._index  = i

    dominoes.push(phys)
  }

  return dominoes
}

function checkCollisions(dominoes) {
  for (let i = 0; i < dominoes.length - 1; i++) {
    const a = dominoes[i]
    const b = dominoes[i + 1]
    if (a._fallen || !a._tilt) continue

    const ax = a.position.x
    const az = a.position.z
    const bx = b.position.x
    const bz = b.position.z

    const dx = bx - ax
    const dz = bz - az
    const dist = Math.sqrt(dx * dx + dz * dz)

    // When domino tilts enough, check if top corner reaches neighbor
    const topReach = Math.sin(Math.abs(a._tilt)) * DOM_H
    if (topReach > dist - DOM_D && !b._fallen && Math.abs(a._tilt) > 0.15) {
      b._angVel += 1.2
    }
  }
}

export function setup(ctx) {
  ctx.camera.position.set(5, 8, 10)
  ctx.camera.lookAt(0, 1, 0)
  ctx.setBloom(0.4)

  const ambient = new Three.AmbientLight(0x223344, 1.2)
  ctx.add(ambient)
  const sun = new Three.DirectionalLight(0xffffff, 1.5)
  sun.position.set(10, 20, 10)
  ctx.add(sun)

  const groundGeo = new Three.PlaneGeometry(30, 30)
  const groundMat = new Three.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9 })
  ctx._ground = new Three.Mesh(groundGeo, groundMat)
  ctx._ground.rotation.x = -Math.PI / 2
  ctx.add(ctx._ground)

  ctx._dominoes = buildDominoes(ctx)
  ctx._lights   = [ambient, sun]
  ctx._started  = false

  // Click to topple first domino
  ctx._onClick = (e) => {
    if (!ctx._started) {
      ctx._dominoes[0]._angVel = 2.5
      ctx._started = true
    }
  }
  ctx.renderer.domElement.addEventListener('click', ctx._onClick)

  // Hint label — just a visible cone pointing at first domino
  const hintGeo = new Three.ConeGeometry(0.15, 0.5, 8)
  const hintMat = new Three.MeshStandardMaterial({ color: 0xffff00, emissive: new Three.Color(0x886600) })
  ctx._hint = new Three.Mesh(hintGeo, hintMat)
  const d0 = ctx._dominoes[0]
  ctx._hint.position.set(d0.position.x, d0.position.y + DOM_H + 0.5, d0.position.z)
  ctx.add(ctx._hint)
}

export function update(ctx, dt) {
  const dt_ = Math.min(dt, 0.05)

  // Fade hint
  if (ctx._started && ctx._hint) {
    ctx._hint.scale.setScalar(Math.max(0, ctx._hint.scale.x - dt * 2))
  }

  for (const dom of ctx._dominoes) {
    if (dom._fallen) continue

    // Angular integration (tilt around local X axis, i.e., domino tips over)
    dom._angVel -= dom._tilt * 0.5 * dt_   // restoring torque (gravity)
    dom._angVel += (dom._tilt > 0 ? 1 : -1) * G * dt_ * 0.4  // gravity tip
    dom._angVel *= DAMPING

    dom._tilt += dom._angVel * dt_

    // Ground contact
    if (Math.abs(dom._tilt) > Math.PI / 2 - 0.05) {
      dom._tilt   = (dom._tilt > 0 ? 1 : -1) * (Math.PI / 2)
      dom._angVel = 0
      dom._fallen = true
    }

    dom._mesh.rotation.y = dom._facing
    dom._mesh.rotation.x = dom._tilt
  }

  checkCollisions(ctx._dominoes)
}

export function teardown(ctx) {
  ctx.renderer.domElement.removeEventListener('click', ctx._onClick)
  for (const dom of ctx._dominoes) ctx.remove(dom._mesh)
  ctx.remove(ctx._ground)
  ctx.remove(ctx._hint)
  for (const l of ctx._lights) ctx.remove(l)
}

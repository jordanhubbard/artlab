// Orbital Dance — "Luminous Choreography"
//
// Five large celestial bodies sweep bright ribbons of light around a burning
// star. Each orbit is drawn as a translucent veil so the tilted planes visibly
// intersect; two bodies share a plane so they eclipse each other periodically.
// A slow cinematic camera rises, dollies, and swings through the system.

import * as Three from 'three'
import { keplerPosition } from '../../src/physics/Physics.js'

const TRAIL_SAMPLES    = 72     // fixed vertices per trail — buffers never resize
const TRAIL_SPAN       = 2.4    // radians of mean anomaly held behind a body
const STAR_RADIUS      = 1.8
const STARFIELD_COUNT  = 1200
const BACKDROP_RADIUS  = 420
const ECLIPSE_PENUMBRA = 1.7    // widens a shadow cone past its geometric edge
const ECLIPSE_DIMMING  = 0.85   // fraction of self-glow lost in full shadow
const BODY_EMISSIVE    = 0.55

// Bodies 3 and 5 share a tilt so their coplanar orbits produce real eclipses.
const BODIES = [
  { a:  5.6, e: 0.14, speed: 0.55, tilt:  0.00, phase: 0.40, radius: 1.20, color: 0xffb46b, glow: 0xff8a3c },
  { a:  7.8, e: 0.24, speed: 0.40, tilt:  0.34, phase: 2.10, radius: 1.45, color: 0x6fd0ff, glow: 0x2aa8ff },
  { a: 10.2, e: 0.10, speed: 0.29, tilt: -0.22, phase: 3.60, radius: 1.00, color: 0x9dffc9, glow: 0x3cff9e },
  { a: 12.8, e: 0.30, speed: 0.21, tilt:  0.52, phase: 5.00, radius: 1.70, color: 0xd9a6ff, glow: 0xa24bff },
  { a: 15.6, e: 0.08, speed: 0.15, tilt: -0.22, phase: 1.20, radius: 1.30, color: 0xffe27a, glow: 0xffb400 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Deterministic PRNG so the starfield is identical on every run. */
function mulberry32(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Register geometries/materials for disposal in teardown(). */
function track(ctx, ...disposables) {
  ctx._disposables.push(...disposables)
}

/** Add a root object to the scene and remember it for teardown(). */
function addRoot(ctx, obj) {
  ctx._objects.push(obj)
  ctx.add(obj)
  return obj
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

// ── Scene construction ────────────────────────────────────────────────────────

/** Inverted gradient dome: an indigo deep field instead of an empty black void. */
function buildBackdrop(ctx) {
  const geometry = new Three.SphereGeometry(BACKDROP_RADIUS, 48, 32)
  const count    = geometry.attributes.position.count
  const colors   = new Float32Array(count * 3)

  const low     = new Three.Color(0x04050d)
  const high    = new Three.Color(0x161033)
  const horizon = new Three.Color(0x2c1436)
  const swatch  = new Three.Color()

  for (let i = 0; i < count; i++) {
    const y = geometry.attributes.position.getY(i) / BACKDROP_RADIUS
    swatch.copy(low).lerp(high, clamp01((y + 1) * 0.5))
    swatch.lerp(horizon, clamp01(1 - Math.abs(y) * 3.2) * 0.55)
    colors[i * 3]     = swatch.r
    colors[i * 3 + 1] = swatch.g
    colors[i * 3 + 2] = swatch.b
  }
  geometry.setAttribute('color', new Three.BufferAttribute(colors, 3))

  const material = new Three.MeshBasicMaterial({
    vertexColors: true, side: Three.BackSide, depthWrite: false,
  })
  track(ctx, geometry, material)
  return new Three.Mesh(geometry, material)
}

function buildStarfield(ctx) {
  const random    = mulberry32(0x51a4)
  const positions = new Float32Array(STARFIELD_COUNT * 3)
  const colors    = new Float32Array(STARFIELD_COUNT * 3)
  const swatch    = new Three.Color()

  for (let i = 0; i < STARFIELD_COUNT; i++) {
    const theta  = random() * Math.PI * 2
    const cosPhi = random() * 2 - 1
    const sinPhi = Math.sqrt(1 - cosPhi * cosPhi)
    const radius = 240 + random() * 150

    positions[i * 3]     = radius * sinPhi * Math.cos(theta)
    positions[i * 3 + 1] = radius * cosPhi
    positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta)

    const warmth    = random()
    const magnitude = 0.35 + random() * 0.65
    swatch.setHSL(warmth < 0.7 ? 0.58 : 0.09, 0.45, 0.5 * magnitude)
    colors[i * 3]     = swatch.r
    colors[i * 3 + 1] = swatch.g
    colors[i * 3 + 2] = swatch.b
  }

  const geometry = new Three.BufferGeometry()
  geometry.setAttribute('position', new Three.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Three.BufferAttribute(colors, 3))

  const material = new Three.PointsMaterial({
    size: 1.9, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.9, depthWrite: false,
  })
  track(ctx, geometry, material)
  return new Three.Points(geometry, material)
}

function buildStar(ctx) {
  const group = new Three.Group()

  const coreGeometry = new Three.SphereGeometry(STAR_RADIUS, 48, 32)
  const coreMaterial = new Three.MeshStandardMaterial({
    color: 0xfff6e0, emissive: new Three.Color(0xffe0a0),
    emissiveIntensity: 2.4, roughness: 1, metalness: 0,
  })
  track(ctx, coreGeometry, coreMaterial)
  const core = new Three.Mesh(coreGeometry, coreMaterial)
  group.add(core)

  for (const [scale, opacity] of [[1.9, 0.22], [3.4, 0.07]]) {
    const geometry = new Three.SphereGeometry(STAR_RADIUS * scale, 32, 24)
    const material = new Three.MeshBasicMaterial({
      color: 0xffc773, transparent: true, opacity,
      blending: Three.AdditiveBlending, depthWrite: false,
    })
    track(ctx, geometry, material)
    group.add(new Three.Mesh(geometry, material))
  }

  return { group, core }
}

/** Elliptical annulus lying in the orbital plane, focus at the origin. */
function buildVeil(ctx, data, innerScale, outerScale, opacity) {
  const semiMinor = data.a * Math.sqrt(1 - data.e * data.e)
  const geometry  = new Three.RingGeometry(innerScale, outerScale, 220)
  const material  = new Three.MeshBasicMaterial({
    color: data.color, transparent: true, opacity, side: Three.DoubleSide,
    blending: Three.AdditiveBlending, depthWrite: false,
  })
  track(ctx, geometry, material)

  const veil = new Three.Mesh(geometry, material)
  veil.rotation.x = -Math.PI / 2
  veil.scale.set(data.a, semiMinor, 1)
  veil.position.x = -data.a * data.e
  return veil
}

/**
 * Trail geometry: a crisp additive core line plus a wider luminous ribbon.
 * Positions are rewritten in place each frame; colours are static fades so
 * only one attribute per object is uploaded.
 */
function buildTrail(ctx, data) {
  const linePositions = new Float32Array(TRAIL_SAMPLES * 3)
  const lineColors    = new Float32Array(TRAIL_SAMPLES * 3)
  const ribbonCount   = TRAIL_SAMPLES * 2
  const ribbonPos     = new Float32Array(ribbonCount * 3)
  const ribbonColors  = new Float32Array(ribbonCount * 3)
  const indices       = new Uint16Array((TRAIL_SAMPLES - 1) * 6)

  const glow   = new Three.Color(data.glow)
  const swatch = new Three.Color()

  for (let i = 0; i < TRAIL_SAMPLES; i++) {
    const age       = i / (TRAIL_SAMPLES - 1)
    const coreFade  = Math.pow(1 - age, 1.5)
    const glowFade  = Math.pow(1 - age, 2.2) * 0.42

    swatch.copy(glow).multiplyScalar(0.25 + 0.75 * coreFade)
    lineColors[i * 3]     = swatch.r
    lineColors[i * 3 + 1] = swatch.g
    lineColors[i * 3 + 2] = swatch.b

    swatch.copy(glow).multiplyScalar(glowFade)
    for (const side of [0, 1]) {
      const v = (i * 2 + side) * 3
      ribbonColors[v]     = swatch.r
      ribbonColors[v + 1] = swatch.g
      ribbonColors[v + 2] = swatch.b
    }

    if (i < TRAIL_SAMPLES - 1) {
      const o = i * 6
      const v = i * 2
      indices[o]     = v
      indices[o + 1] = v + 1
      indices[o + 2] = v + 2
      indices[o + 3] = v + 1
      indices[o + 4] = v + 3
      indices[o + 5] = v + 2
    }
  }

  const lineGeometry = new Three.BufferGeometry()
  lineGeometry.setAttribute('position', new Three.BufferAttribute(linePositions, 3))
  lineGeometry.setAttribute('color', new Three.BufferAttribute(lineColors, 3))
  const lineMaterial = new Three.LineBasicMaterial({
    vertexColors: true, transparent: true,
    blending: Three.AdditiveBlending, depthWrite: false,
  })
  track(ctx, lineGeometry, lineMaterial)
  const line = new Three.Line(lineGeometry, lineMaterial)
  line.frustumCulled = false

  const ribbonGeometry = new Three.BufferGeometry()
  ribbonGeometry.setAttribute('position', new Three.BufferAttribute(ribbonPos, 3))
  ribbonGeometry.setAttribute('color', new Three.BufferAttribute(ribbonColors, 3))
  ribbonGeometry.setIndex(new Three.BufferAttribute(indices, 1))
  const ribbonMaterial = new Three.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.75, side: Three.DoubleSide,
    blending: Three.AdditiveBlending, depthWrite: false,
  })
  track(ctx, ribbonGeometry, ribbonMaterial)
  const ribbon = new Three.Mesh(ribbonGeometry, ribbonMaterial)
  ribbon.frustumCulled = false

  return { line, ribbon, linePositions, ribbonPos }
}

function buildBody(ctx, data) {
  const group = new Three.Group()
  group.rotation.x = data.tilt

  const veil = buildVeil(ctx, data, 0.988, 1.012, 0.20)
  const band = buildVeil(ctx, data, 0.90, 1.10, 0.03)
  group.add(veil, band)

  const geometry = new Three.SphereGeometry(data.radius, 40, 28)
  const material = new Three.MeshStandardMaterial({
    color: data.color, roughness: 0.55, metalness: 0.15,
    emissive: new Three.Color(data.glow), emissiveIntensity: BODY_EMISSIVE,
  })
  track(ctx, geometry, material)
  const mesh = new Three.Mesh(geometry, material)
  mesh.castShadow    = true
  mesh.receiveShadow = true
  group.add(mesh)

  const trail = buildTrail(ctx, data)
  group.add(trail.line, trail.ribbon)

  return {
    data, group, mesh, veil, band,
    line: trail.line,
    ribbon: trail.ribbon,
    linePositions: trail.linePositions,
    ribbonPositions: trail.ribbonPos,
  }
}

// ── Per-frame posing (no allocation of geometry or materials) ──────────────────

/** Rewrite one body's position and trail buffers for the given time. */
function poseBody(body, elapsed, worldPos, index) {
  const { a, e, speed, phase, tilt, radius } = body.data
  const meanAnomaly = elapsed * speed + phase
  const halfWidth   = 0.22 + 0.42 * radius
  const line        = body.linePositions
  const ribbon      = body.ribbonPositions

  for (let i = 0; i < TRAIL_SAMPLES; i++) {
    const age = i / (TRAIL_SAMPLES - 1)
    const { x, z } = keplerPosition(a, e, meanAnomaly - age * TRAIL_SPAN)

    line[i * 3]     = x
    line[i * 3 + 1] = 0
    line[i * 3 + 2] = z

    // Widen the ribbon radially inside the orbital plane.
    const r  = Math.hypot(x, z) || 1
    const w  = halfWidth * Math.pow(1 - age, 0.8)
    const ox = (x / r) * w
    const oz = (z / r) * w

    const outer = i * 6
    ribbon[outer]     = x + ox
    ribbon[outer + 1] = 0
    ribbon[outer + 2] = z + oz
    ribbon[outer + 3] = x - ox
    ribbon[outer + 4] = 0
    ribbon[outer + 5] = z - oz

    if (i === 0) {
      body.mesh.position.set(x, 0, z)
      // The group only rotates about X, so world coordinates are direct.
      worldPos[index * 3]     = x
      worldPos[index * 3 + 1] = -z * Math.sin(tilt)
      worldPos[index * 3 + 2] = z * Math.cos(tilt)
    }
  }

  body.line.geometry.attributes.position.needsUpdate = true
  body.ribbon.geometry.attributes.position.needsUpdate = true
}

/** Shadow fraction on each body cast by any body closer to the star. */
function poseEclipses(bodies, worldPos, eclipse) {
  for (let i = 0; i < bodies.length; i++) {
    const xi = worldPos[i * 3], yi = worldPos[i * 3 + 1], zi = worldPos[i * 3 + 2]
    const ri = Math.hypot(xi, yi, zi) || 1
    let shadow = 0

    for (let j = 0; j < bodies.length; j++) {
      if (j === i) continue
      const xj = worldPos[j * 3], yj = worldPos[j * 3 + 1], zj = worldPos[j * 3 + 2]
      const rj = Math.hypot(xj, yj, zj) || 1
      if (rj >= ri) continue

      const separation  = Math.acos(clamp01((xi * xj + yi * yj + zi * zj) / (ri * rj)))
      const angularSize = Math.asin(Math.min(1, bodies[j].data.radius / rj))
      const coverage    = clamp01(1 - separation / (angularSize * ECLIPSE_PENUMBRA))
      if (coverage > shadow) shadow = coverage
    }

    eclipse[i] = shadow
    bodies[i].mesh.material.emissiveIntensity = BODY_EMISSIVE * (1 - ECLIPSE_DIMMING * shadow)
  }
}

/** Slow rise, dolly, and swing so the composition keeps re-framing itself. */
function poseCamera(ctx, elapsed) {
  const angle  = elapsed * 0.075 + 0.45 * Math.sin(elapsed * 0.031)
  const radius = 26 + 5.5 * Math.sin(elapsed * 0.085)
  const height = 6.0 + 5.5 * Math.sin(elapsed * 0.11 + 0.4)

  ctx.camera.position.set(radius * Math.sin(angle), height, radius * Math.cos(angle))
  ctx.camera.lookAt(
    1.6 * Math.sin(elapsed * 0.047),
    0.8 * Math.sin(elapsed * 0.039 + 2.0),
    1.6 * Math.cos(elapsed * 0.043),
  )
}

function poseSystem(ctx, elapsed) {
  for (let i = 0; i < ctx._bodies.length; i++) {
    poseBody(ctx._bodies[i], elapsed, ctx._worldPos, i)
  }
  poseEclipses(ctx._bodies, ctx._worldPos, ctx._eclipse)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function setup(ctx) {
  ctx.setHelp('Five worlds orbit a burning star — watch for eclipses as the camera drifts')

  ctx._disposables = []
  ctx._objects     = []
  ctx._restore     = {
    controlsEnabled: ctx.controls.enabled,
    shadowsEnabled:  ctx.renderer.shadowMap.enabled,
  }

  ctx.controls.enabled = false
  ctx.renderer.shadowMap.enabled = true
  ctx.setBloom(0.6)

  ctx._backdrop  = addRoot(ctx, buildBackdrop(ctx))
  ctx._starfield = addRoot(ctx, buildStarfield(ctx))

  const star = buildStar(ctx)
  ctx._star = star.core
  addRoot(ctx, star.group)

  addRoot(ctx, new Three.AmbientLight(0x161d38, 0.6))

  const sunLight = new Three.PointLight(0xffe0b0, 620, 0, 2)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(1024, 1024)
  sunLight.shadow.camera.near = 0.5
  sunLight.shadow.camera.far  = 60
  addRoot(ctx, sunLight)

  ctx._bodies   = BODIES.map(data => buildBody(ctx, data))
  ctx._worldPos = new Float64Array(ctx._bodies.length * 3)
  ctx._eclipse  = new Float32Array(ctx._bodies.length)
  for (const body of ctx._bodies) addRoot(ctx, body.group)

  // Compose the very first frame so nothing appears at the origin unlit.
  poseSystem(ctx, 0)
  poseCamera(ctx, 0)
}

export function update(ctx) {
  const elapsed = ctx.elapsed ?? 0
  poseSystem(ctx, elapsed)
  poseCamera(ctx, elapsed)
}

export function teardown(ctx) {
  if (!ctx._objects) return

  for (const obj of ctx._objects) ctx.remove(obj)
  for (const disposable of ctx._disposables) disposable.dispose()

  if (ctx._restore) {
    ctx.controls.enabled = ctx._restore.controlsEnabled
    ctx.renderer.shadowMap.enabled = ctx._restore.shadowsEnabled
  }

  ctx._objects = null
  ctx._disposables = null
  ctx._bodies = null
  ctx._backdrop = null
  ctx._starfield = null
  ctx._star = null
  ctx._restore = null
}

// audio-terrain.js — Microphone-driven terrain with reactive particles and height-mapped vertex colors
import * as THREE from 'three'
import { MicrophoneInput } from '../../src/stdlib/media.js'
import { ResourceScope, GestureButton } from '../../src/stdlib/scene.js'
import { createParticleWorld, emitter, forceField } from '../../src/stdlib/physics/particles.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const SEGS      = 80
const NUM_VERTS = (SEGS + 1) * (SEGS + 1)
const TERRAIN_W = 40

// Height color palette: dark purple → blue → cyan
const _BASE = new THREE.Color(0x1a0030)
const _MID  = new THREE.Color(0x0033cc)
const _PEAK = new THREE.Color(0x00eeff)

// ── Module state ──────────────────────────────────────────────────────────────

let _terrain, _terrainGeo, _posAttr, _colAttr
let _pworld, _spark
let _ambLight, _hemiLight
let _startBtn
let _microphone, _scope

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export async function setup(ctx) {
  _scope = new ResourceScope()
  _microphone = _scope.own(new MicrophoneInput())
  ctx.camera.position.set(28, 14, 0)
  ctx.camera.lookAt(0, 0, 0)

  _ambLight = new THREE.AmbientLight(0x110022, 0.8)
  _scope.add(ctx, _ambLight)

  _hemiLight = new THREE.HemisphereLight(0x0033bb, 0x110022, 0.5)
  _scope.add(ctx, _hemiLight)

  // Terrain: flat grid rotated to lie in XZ plane; Y becomes height
  _terrainGeo = new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_W, SEGS, SEGS)
  _terrainGeo.rotateX(-Math.PI / 2)

  _posAttr = _terrainGeo.attributes.position
  _posAttr.setUsage(THREE.DynamicDrawUsage)

  const colorBuf = new Float32Array(NUM_VERTS * 3)
  _colAttr = new THREE.BufferAttribute(colorBuf, 3)
  _colAttr.setUsage(THREE.DynamicDrawUsage)
  _terrainGeo.setAttribute('color', _colAttr)

  _terrain = new THREE.Mesh(
    _terrainGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true }),
  )
  _scope.add(ctx, _terrain)

  // Sparkle particles — emitter position tracks terrain peak each frame
  _pworld = createParticleWorld()
  _spark  = emitter(_pworld, ctx.scene, {
    rate: 40, speed: 5, spread: 18, lifetime: 1.0,
    color: 0xffffff, size: 0.12, gravity: 0, maxParticles: 300,
  })

  ctx.setBloom(0.9)

  const microphone = _microphone
  _startBtn = _scope.own(new GestureButton(ctx.renderer.domElement.parentElement, {
    label: 'Enable Microphone', start: () => microphone.start(),
  }))
  _scope.own(_spark)

}

export function update(ctx, dt) {
  const t = ctx.elapsed

  // Get audio bands, or use gentle procedural fallback when mic is off
  let bass, mid, high
  _microphone.update()
  if (_microphone.active) {
    bass = _microphone.level(0, 0.1)
    mid = _microphone.level(0.1, 0.5)
    high = _microphone.level(0.5, 1)
  } else {
    bass = 0.28 + 0.18 * Math.sin(t * 0.37)
    mid  = 0.18 + 0.14 * Math.sin(t * 0.83 + 1.1)
    high = 0.08 + 0.07 * Math.sin(t * 2.2  + 2.0)
  }

  // Deform terrain and compute vertex colors in one pass
  const pos = _posAttr.array
  const col = _colAttr.array
  let maxY = 0.01, peakX = 0, peakZ = 0

  for (let i = 0; i < NUM_VERTS; i++) {
    // X and Z are set once by rotateX and never modified — safe to read each frame
    const x = pos[i * 3]
    const z = pos[i * 3 + 2]

    // Bass → large slow mountains; mid → medium ripples; high → fine sparkle
    const y =
      bass * 3.5 * Math.sin(0.14 * x + t * 0.33) * Math.cos(0.14 * z + t * 0.27) +
      mid  * 1.3 * Math.sin(0.37 * x + t * 0.81) * Math.cos(0.37 * z + t * 0.68) +
      high * 0.5 * Math.sin(1.05 * x + t * 2.05) * Math.cos(1.05 * z + t * 1.85)

    pos[i * 3 + 1] = y

    if (y > maxY) { maxY = y; peakX = x; peakZ = z }

    // Vertex color: dark purple → blue → cyan mapped over [0, 4.2] height range
    const frac = Math.max(0, Math.min(1, y / 4.2))
    if (frac < 0.5) {
      const s = frac * 2
      col[i * 3]     = _BASE.r + (_MID.r  - _BASE.r) * s
      col[i * 3 + 1] = _BASE.g + (_MID.g  - _BASE.g) * s
      col[i * 3 + 2] = _BASE.b + (_MID.b  - _BASE.b) * s
    } else {
      const s = (frac - 0.5) * 2
      col[i * 3]     = _MID.r  + (_PEAK.r - _MID.r)  * s
      col[i * 3 + 1] = _MID.g  + (_PEAK.g - _MID.g)  * s
      col[i * 3 + 2] = _MID.b  + (_PEAK.b - _MID.b)  * s
    }
  }

  _posAttr.needsUpdate = true
  _colAttr.needsUpdate = true
  _terrainGeo.computeVertexNormals()

  // Smoothly track sparkle emitter to the current terrain peak
  const lf = Math.min(1, 3 * dt)
  _spark.points.position.x += (peakX - _spark.points.position.x) * lf
  _spark.points.position.y  = maxY
  _spark.points.position.z += (peakZ - _spark.points.position.z) * lf

  // High frequencies add an upward impulse to particles near the emitter origin
  if (high > 0.25) {
    forceField(_pworld, _spark.emitterId, { x: 0, y: 0, z: 0 }, 6, {
      x: 0, y: high * 5 * dt, z: 0,
    })
  }

  _spark.update(ctx.elapsed, dt)

  // Slowly orbit camera around the terrain center
  const r = 28
  ctx.camera.position.x = Math.cos(t * 0.09) * r
  ctx.camera.position.z = Math.sin(t * 0.09) * r
  ctx.camera.position.y = 14 + 3 * Math.sin(t * 0.05)
  ctx.camera.lookAt(0, 1, 0)
}

export function teardown() { return _scope.dispose() }

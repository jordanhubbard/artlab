// neon-city.js — synthwave cyberpunk cityscape with procedural buildings and bloom

import * as THREE from 'three'

const PINK   = 0xff0066
const CYAN   = 0x00ffff
const PURPLE = 0x6600cc

let _objects = []
let _prevFog = null
let _prevBg  = null

// Deterministic pseudo-random [0,1) from an integer seed
function hash(n) {
  const x = Math.sin(n) * 43758.5453
  return x - Math.floor(x)
}

// Canvas texture with a randomised grid of lit windows on a dark face.
// Falls back gracefully to an undrawn CanvasTexture when the 2D context is
// unavailable (e.g. in test environments without a canvas implementation).
function makeWindowTex(color) {
  const canvas = document.createElement('canvas')
  canvas.width = 128; canvas.height = 256
  const g = canvas.getContext('2d')
  if (g) {
    g.fillStyle = '#000000'
    g.fillRect(0, 0, 128, 256)
    const cols = 4, rows = 8, padX = 6, padY = 5
    const ww = (128 - padX * (cols + 1)) / cols
    const wh = (256 - padY * (rows + 1)) / rows
    g.fillStyle = '#' + color.toString(16).padStart(6, '0')
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.28) {
          g.fillRect(padX + c * (ww + padX), padY + r * (wh + padY), ww, wh)
        }
      }
    }
  }
  return new THREE.CanvasTexture(canvas)
}

function tracked(ctx, obj) {
  ctx.add(obj)
  _objects.push(obj)
  return obj
}

export async function setup(ctx) {
  _objects = []
  _prevFog = ctx.scene.fog
  _prevBg  = ctx.scene.background

  ctx.scene.fog = new THREE.FogExp2(0x000000, 0.018)
  ctx.scene.background = new THREE.Color(0x000000)
  ctx.setBloom(1.2)

  ctx.camera.position.set(0, 4, 160)
  ctx.camera.lookAt(0, 4, 150)
  if (ctx.controls) ctx.controls.enabled = false

  // Lighting — dim purple ambient + two accent point lights
  tracked(ctx, new THREE.AmbientLight(0x0a0018, 2.0))
  const pl1 = new THREE.PointLight(PINK, 200, 120, 2)
  pl1.position.set(0, 20, 0)
  tracked(ctx, pl1)
  const pl2 = new THREE.PointLight(CYAN, 100, 80, 2)
  pl2.position.set(30, 10, 60)
  tracked(ctx, pl2)

  // Dark reflective ground plane
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({
      color: 0x050008, roughness: 0.15, metalness: 0.9,
      emissive: 0x0a0018, emissiveIntensity: 0.4,
    })
  )
  ground.rotation.x = -Math.PI / 2
  tracked(ctx, ground)

  // Grid lines on the ground surface
  const grid = new THREE.GridHelper(500, 50, CYAN, 0x220033)
  grid.material.opacity = 0.35
  grid.material.transparent = true
  tracked(ctx, grid)

  // Pre-built window textures: 2 random variants per accent colour
  const palette = [PINK, CYAN, PURPLE]
  const winTex = palette.map(c => [makeWindowTex(c), makeWindowTex(c)])

  // Procedural buildings on a street-grid
  //   X columns: ±[10, 22, 36, 54, 76] units from centre street
  //   Z rows: every 18 units (-12 to +12)
  //   Some slots skipped to create cross-streets and visual breathing room
  const xCols = [10, 22, 36, 54, 76]
  for (let zi = -12; zi <= 12; zi++) {
    const zBase = zi * 18
    for (let side = -1; side <= 1; side += 2) {
      for (let xi = 0; xi < xCols.length; xi++) {
        const seed = zi * 100 + (side > 0 ? 50 : 0) + xi

        // ~15% random gaps for visual variety
        if (hash(seed * 13 + 3) < 0.15) continue
        // Cross-street openings on the inner two columns
        if (xi < 2 && Math.abs(zi) % 5 === 0) continue

        const x = side * (xCols[xi] + hash(seed * 7 + 1) * 4 - 2)
        const z = zBase + hash(seed * 7 + 2) * 6 - 3
        const w = 6  + hash(seed * 7 + 3) * 10         // width  6–16
        const h = 10 + hash(seed * 7 + 4) * (xi === 0 ? 45 : 28)  // tallest near street
        const d = 5  + hash(seed * 7 + 5) * 8          // depth  5–13
        const ci = Math.floor(hash(seed * 7 + 6) * 3)  // colour index
        const ti = Math.floor(hash(seed * 3 + 11) * 2) // texture variant

        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshStandardMaterial({
            color: 0x080010,
            emissive: palette[ci],
            emissiveMap: winTex[ci][ti],
            emissiveIntensity: 0.9,
            roughness: 0.75,
            metalness: 0.35,
          })
        )
        mesh.position.set(x, h / 2, z)
        tracked(ctx, mesh)
      }
    }
  }

  // Stars — small point-cloud particles above the city
  const N = 1500
  const starPos = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    starPos[i * 3]     = (Math.random() - 0.5) * 600
    starPos[i * 3 + 1] = 50 + Math.random() * 250
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 600
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  tracked(ctx, new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.85 })
  ))
}

export function update(ctx, dt) {  // eslint-disable-line no-unused-vars
  // Camera cruises along Z with a gentle sway on X
  const z    = 180 - (ctx.elapsed * 8 % 400)
  const sway = Math.sin(ctx.elapsed * 0.25) * 3
  ctx.camera.position.set(sway, 4 + Math.sin(ctx.elapsed * 0.1) * 0.3, z)
  ctx.camera.lookAt(sway * 0.3, 3.8, z - 25)
}

export function teardown(ctx) {
  for (const obj of _objects) ctx.remove(obj)
  _objects = []
  ctx.scene.fog = _prevFog
  ctx.scene.background = _prevBg
  if (ctx.controls) ctx.controls.enabled = true
}

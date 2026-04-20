// reaction-diffusion.js — Gray-Scott reaction-diffusion simulation on a rotating sphere
import * as THREE from 'three'

const W = 256, H = 256, N = W * H
const STEPS_PER_FRAME = 8
// Classic coral/maze parameters
const Du = 0.16, Dv = 0.08, F = 0.055, K = 0.062

let _sphere, _texture, _canvas, _ctx2d, _imageData
let _ambient, _prevBg
let _U, _V, _nextU, _nextV

function initGrid() {
  _U = new Float32Array(N).fill(1.0)
  _V = new Float32Array(N)
  _nextU = new Float32Array(N)
  _nextV = new Float32Array(N)
  for (let s = 0; s < 12; s++) {
    const cx = Math.floor(Math.random() * W)
    const cy = Math.floor(Math.random() * H)
    const r = 6 + Math.floor(Math.random() * 8)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          const px = ((cx + dx) % W + W) % W
          const py = ((cy + dy) % H + H) % H
          _U[py * W + px] = 0.5
          _V[py * W + px] = 0.25
        }
      }
    }
  }
}

function stepGrid() {
  for (let y = 0; y < H; y++) {
    const yw = y * W
    const yn = ((y - 1 + H) % H) * W
    const ys = ((y + 1) % H) * W
    for (let x = 0; x < W; x++) {
      const i  = yw + x
      const xl = (x - 1 + W) % W
      const xr = (x + 1) % W
      const ui = _U[i], vi = _V[i]
      const uvv = ui * vi * vi
      const lapU = _U[yn + x] + _U[ys + x] + _U[yw + xl] + _U[yw + xr] - 4 * ui
      const lapV = _V[yn + x] + _V[ys + x] + _V[yw + xl] + _V[yw + xr] - 4 * vi
      _nextU[i] = ui + Du * lapU - uvv + F * (1 - ui)
      _nextV[i] = vi + Dv * lapV + uvv - (F + K) * vi
    }
  }
  const tu = _U; _U = _nextU; _nextU = tu
  const tv = _V; _V = _nextV; _nextV = tv
}

// Maps V concentration [0..1] through dark-blue → cyan → bright white
function paintCanvas() {
  const d = _imageData.data
  for (let i = 0; i < N; i++) {
    const v = Math.max(0, Math.min(1, _V[i] * 3.5))
    let r, g, b
    if (v < 0.5) {
      const t = v * 2
      r = 0
      g = Math.floor(t * 220)
      b = Math.floor(20 + t * 235)
    } else {
      const t = (v - 0.5) * 2
      r = Math.floor(t * 255)
      g = Math.floor(220 + t * 35)
      b = 255
    }
    const p = i * 4
    d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255
  }
  _ctx2d.putImageData(_imageData, 0, 0)
}

export async function setup(ctx) {
  _prevBg = ctx.scene.background
  ctx.scene.background = new THREE.Color(0x020408)

  _ambient = new THREE.AmbientLight(0x112233, 0.6)
  ctx.add(_ambient)

  ctx.camera.position.set(0, 0, 3.5)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(1.5)

  _canvas = document.createElement('canvas')
  _canvas.width = W
  _canvas.height = H
  _ctx2d = _canvas.getContext('2d')
  _imageData = _ctx2d.createImageData(W, H)

  initGrid()

  _texture = new THREE.CanvasTexture(_canvas)
  const geo = new THREE.SphereGeometry(1.5, 64, 64)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x001122,
    emissive: new THREE.Color(1, 1, 1),
    emissiveMap: _texture,
    emissiveIntensity: 1.0,
    roughness: 0.4,
    metalness: 0.1,
  })
  _sphere = new THREE.Mesh(geo, mat)
  ctx.add(_sphere)
}

export function update(ctx, dt) {  // eslint-disable-line no-unused-vars
  for (let s = 0; s < STEPS_PER_FRAME; s++) stepGrid()
  paintCanvas()
  _texture.needsUpdate = true
  _sphere.rotation.y += dt * 0.18
}

export function teardown(ctx) {
  ctx.remove(_sphere)
  ctx.remove(_ambient)
  _sphere.geometry.dispose()
  _sphere.material.dispose()
  _texture.dispose()
  ctx.scene.background = _prevBg
}

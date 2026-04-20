// reaction-diffusion — Gray-Scott system on a 256×256 DataTexture producing Turing patterns.
import * as Three from 'three'

const W  = 256
const H  = 256
const F  = 0.055   // feed rate
const K  = 0.062   // kill rate
const DA = 1.0     // diffusion A
const DB = 0.5     // diffusion B
const STEPS_PER_FRAME = 10

function idx(x, y) {
  return ((y + H) % H) * W + ((x + W) % W)
}

export function setup(ctx) {
  ctx.camera.position.set(0, 0, 7)
  ctx.setBloom(0.8)
  ctx.add(new Three.AmbientLight(0xffffff, 1.0))

  const N = W * H
  ctx._A = new Float32Array(N)
  ctx._B = new Float32Array(N)
  ctx._nA = new Float32Array(N)
  ctx._nB = new Float32Array(N)

  // Initialize: all A=1, B=0
  ctx._A.fill(1.0)
  ctx._B.fill(0.0)

  // Seed center square with B
  const cx = W >> 1
  const cy = H >> 1
  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const i = idx(cx + dx, cy + dy)
      ctx._A[i] = 0.5 + (Math.random() - 0.5) * 0.1
      ctx._B[i] = 0.25 + (Math.random() - 0.5) * 0.1
    }
  }

  // DataTexture: RGBA Uint8
  ctx._texData = new Uint8Array(N * 4)
  ctx._texture = new Three.DataTexture(ctx._texData, W, H, Three.RGBAFormat)
  ctx._texture.needsUpdate = true

  const geo = new Three.PlaneGeometry(6, 6)
  const mat = new Three.MeshBasicMaterial({ map: ctx._texture })
  ctx._quad = new Three.Mesh(geo, mat)
  ctx.add(ctx._quad)
}

function rdStep(ctx) {
  const A  = ctx._A
  const B  = ctx._B
  const nA = ctx._nA
  const nB = ctx._nB

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y)
      const a = A[i]
      const b = B[i]

      // Laplacian (3×3 kernel, Moore neighborhood)
      const lapA =
        -a +
        0.2 * (A[idx(x-1,y)] + A[idx(x+1,y)] + A[idx(x,y-1)] + A[idx(x,y+1)]) +
        0.05 * (A[idx(x-1,y-1)] + A[idx(x+1,y-1)] + A[idx(x-1,y+1)] + A[idx(x+1,y+1)])
      const lapB =
        -b +
        0.2 * (B[idx(x-1,y)] + B[idx(x+1,y)] + B[idx(x,y-1)] + B[idx(x,y+1)]) +
        0.05 * (B[idx(x-1,y-1)] + B[idx(x+1,y-1)] + B[idx(x-1,y+1)] + B[idx(x+1,y+1)])

      const reaction = a * b * b
      const dt = 1.0
      nA[i] = Math.min(1, Math.max(0, a + (DA * lapA - reaction + F * (1 - a)) * dt))
      nB[i] = Math.min(1, Math.max(0, b + (DB * lapB + reaction - (K + F) * b) * dt))
    }
  }

  // Swap buffers
  ctx._A = nA
  ctx._B = nB
  ctx._nA = A
  ctx._nB = B
}

function updateTexture(ctx) {
  const B  = ctx._B
  const td = ctx._texData
  for (let i = 0; i < W * H; i++) {
    const b = B[i]
    // cyan (low B) → magenta (high B)
    const r = Math.floor(b * 200 + 40)
    const g = Math.floor((1 - b) * 160 + 20)
    const bl = Math.floor(b * 180 + 60)
    td[i * 4]     = r
    td[i * 4 + 1] = g
    td[i * 4 + 2] = bl
    td[i * 4 + 3] = 255
  }
  ctx._texture.needsUpdate = true
}

export function update(ctx, dt) {
  for (let s = 0; s < STEPS_PER_FRAME; s++) rdStep(ctx)
  updateTexture(ctx)
}

export function teardown(ctx) {
  ctx.remove(ctx._quad)
  ctx._texture.dispose()
}

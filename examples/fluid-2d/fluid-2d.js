// fluid-2d — Navier-Stokes stable fluid solver on a 2D grid with heatmap DataTexture.
import * as Three from 'three'

const N       = 96       // grid resolution (N×N interior cells)
const SIZE    = N + 2    // with boundary
const DIFF    = 0.0001   // diffusion rate
const VISC    = 0.0      // viscosity
const DT      = 0.1      // simulation timestep
const ITER    = 4        // Gauss-Seidel iterations

function IX(i, j) { return i + j * SIZE }

function addSource(x, s, dt) {
  for (let i = 0; i < x.length; i++) x[i] += s[i] * dt
}

function setBnd(b, x) {
  for (let i = 1; i <= N; i++) {
    x[IX(0,     i)] = b === 1 ? -x[IX(1, i)] : x[IX(1, i)]
    x[IX(N + 1, i)] = b === 1 ? -x[IX(N, i)] : x[IX(N, i)]
    x[IX(i,     0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)]
    x[IX(i, N + 1)] = b === 2 ? -x[IX(i, N)] : x[IX(i, N)]
  }
  x[IX(0,     0)]     = 0.5 * (x[IX(1, 0)]     + x[IX(0, 1)])
  x[IX(0,     N + 1)] = 0.5 * (x[IX(1, N + 1)] + x[IX(0, N)])
  x[IX(N + 1, 0)]     = 0.5 * (x[IX(N, 0)]     + x[IX(N + 1, 1)])
  x[IX(N + 1, N + 1)] = 0.5 * (x[IX(N, N + 1)] + x[IX(N + 1, N)])
}

function diffuse(b, x, x0, diff, dt) {
  const a = dt * diff * N * N
  for (let k = 0; k < ITER; k++) {
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        x[IX(i, j)] = (x0[IX(i, j)] + a * (
          x[IX(i - 1, j)] + x[IX(i + 1, j)] +
          x[IX(i, j - 1)] + x[IX(i, j + 1)]
        )) / (1 + 4 * a)
      }
    }
    setBnd(b, x)
  }
}

function advect(b, d, d0, u, v, dt) {
  const dt0 = dt * N
  for (let j = 1; j <= N; j++) {
    for (let i = 1; i <= N; i++) {
      let x = i - dt0 * u[IX(i, j)]
      let y = j - dt0 * v[IX(i, j)]
      if (x < 0.5) x = 0.5
      if (x > N + 0.5) x = N + 0.5
      const i0 = Math.floor(x)
      const i1 = i0 + 1
      if (y < 0.5) y = 0.5
      if (y > N + 0.5) y = N + 0.5
      const j0 = Math.floor(y)
      const j1 = j0 + 1
      const s1 = x - i0
      const s0 = 1 - s1
      const t1 = y - j0
      const t0 = 1 - t1
      d[IX(i, j)] =
        s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) +
        s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)])
    }
  }
  setBnd(b, d)
}

function project(u, v, p, div) {
  for (let j = 1; j <= N; j++) {
    for (let i = 1; i <= N; i++) {
      div[IX(i, j)] = -0.5 * (
        u[IX(i + 1, j)] - u[IX(i - 1, j)] +
        v[IX(i, j + 1)] - v[IX(i, j - 1)]
      ) / N
      p[IX(i, j)] = 0
    }
  }
  setBnd(0, div)
  setBnd(0, p)

  for (let k = 0; k < ITER; k++) {
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        p[IX(i, j)] = (div[IX(i, j)] +
          p[IX(i - 1, j)] + p[IX(i + 1, j)] +
          p[IX(i, j - 1)] + p[IX(i, j + 1)]
        ) / 4
      }
    }
    setBnd(0, p)
  }

  for (let j = 1; j <= N; j++) {
    for (let i = 1; i <= N; i++) {
      u[IX(i, j)] -= 0.5 * N * (p[IX(i + 1, j)] - p[IX(i - 1, j)])
      v[IX(i, j)] -= 0.5 * N * (p[IX(i, j + 1)] - p[IX(i, j - 1)])
    }
  }
  setBnd(1, u)
  setBnd(2, v)
}

function velStep(u, v, u0, v0, visc, dt) {
  addSource(u, u0, dt)
  addSource(v, v0, dt)
  // swap u, u0
  let tmp = u0.slice(); u0.set(u); u.set(tmp)
  diffuse(1, u, u0, visc, dt)
  tmp = v0.slice(); v0.set(v); v.set(tmp)
  diffuse(2, v, v0, visc, dt)
  project(u, v, u0, v0)
  tmp = u0.slice(); u0.set(u); u.set(tmp)
  tmp = v0.slice(); v0.set(v); v.set(tmp)
  advect(1, u, u0, u0, v0, dt)
  advect(2, v, v0, u0, v0, dt)
  project(u, v, u0, v0)
}

function densStep(x, x0, u, v, diff, dt) {
  addSource(x, x0, dt)
  const tmp = x0.slice(); x0.set(x); x.set(tmp)
  diffuse(0, x, x0, diff, dt)
  const tmp2 = x0.slice(); x0.set(x); x.set(tmp2)
  advect(0, x, x0, u, v, dt)
}

// Heatmap: density → color (black→blue→cyan→green→yellow→red→white)
function heatColor(val) {
  const t = Math.min(1, Math.max(0, val))
  let r = 0, g = 0, b = 0
  if (t < 0.167) {
    b = t / 0.167
  } else if (t < 0.333) {
    const f = (t - 0.167) / 0.166
    b = 1; g = f
  } else if (t < 0.5) {
    const f = (t - 0.333) / 0.167
    g = 1; b = 1 - f
  } else if (t < 0.667) {
    const f = (t - 0.5) / 0.167
    g = 1; r = f
  } else if (t < 0.833) {
    const f = (t - 0.667) / 0.166
    r = 1; g = 1 - f
  } else {
    const f = (t - 0.833) / 0.167
    r = 1; g = f; b = f
  }
  return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)]
}

export function setup(ctx) {
  ctx.camera.position.set(0, 0, 7)
  ctx.setBloom(0.4)

  const total = SIZE * SIZE
  ctx._u  = new Float32Array(total)
  ctx._v  = new Float32Array(total)
  ctx._u0 = new Float32Array(total)
  ctx._v0 = new Float32Array(total)
  ctx._d  = new Float32Array(total)
  ctx._d0 = new Float32Array(total)

  // DataTexture for visualization (interior N×N)
  ctx._texData = new Uint8Array(N * N * 4)
  ctx._texture = new Three.DataTexture(ctx._texData, N, N, Three.RGBAFormat)
  ctx._texture.needsUpdate = true

  const geo = new Three.PlaneGeometry(6, 6)
  const mat = new Three.MeshBasicMaterial({ map: ctx._texture })
  ctx._quad = new Three.Mesh(geo, mat)
  ctx.add(ctx._quad)

  // Mouse tracking for velocity/dye injection
  ctx._mouseDown = false
  ctx._mouseX = 0
  ctx._mouseY = 0
  ctx._pmouseX = 0
  ctx._pmouseY = 0

  ctx._onMouseMove = (event) => {
    const rect = ctx.renderer.domElement.getBoundingClientRect()
    ctx._pmouseX = ctx._mouseX
    ctx._pmouseY = ctx._mouseY
    ctx._mouseX = (event.clientX - rect.left) / rect.width
    ctx._mouseY = 1.0 - (event.clientY - rect.top) / rect.height
  }
  ctx._onMouseDown = () => { ctx._mouseDown = true }
  ctx._onMouseUp = () => { ctx._mouseDown = false }

  ctx.renderer.domElement.addEventListener('mousemove', ctx._onMouseMove)
  ctx.renderer.domElement.addEventListener('mousedown', ctx._onMouseDown)
  ctx.renderer.domElement.addEventListener('mouseup', ctx._onMouseUp)
}

export function update(ctx, dt) {
  ctx._u0.fill(0)
  ctx._v0.fill(0)
  ctx._d0.fill(0)

  // Mouse injection
  if (ctx._mouseDown) {
    const i = Math.floor(ctx._mouseX * N) + 1
    const j = Math.floor(ctx._mouseY * N) + 1
    if (i >= 1 && i <= N && j >= 1 && j <= N) {
      const dx = (ctx._mouseX - ctx._pmouseX) * N * 5
      const dy = (ctx._mouseY - ctx._pmouseY) * N * 5
      // Inject velocity and density in a small radius
      const radius = 3
      for (let di = -radius; di <= radius; di++) {
        for (let dj = -radius; dj <= radius; dj++) {
          const ci = i + di
          const cj = j + dj
          if (ci >= 1 && ci <= N && cj >= 1 && cj <= N) {
            ctx._u0[IX(ci, cj)] = dx
            ctx._v0[IX(ci, cj)] = dy
            ctx._d0[IX(ci, cj)] = 10.0
          }
        }
      }
    }
  }

  velStep(ctx._u, ctx._v, ctx._u0, ctx._v0, VISC, DT)
  densStep(ctx._d, ctx._d0, ctx._u, ctx._v, DIFF, DT)

  // Density decay
  for (let i = 0; i < ctx._d.length; i++) {
    ctx._d[i] *= 0.99
  }

  // Render density to texture
  const td = ctx._texData
  for (let j = 1; j <= N; j++) {
    for (let i = 1; i <= N; i++) {
      const density = ctx._d[IX(i, j)]
      const [r, g, b] = heatColor(density)
      const ti = ((j - 1) * N + (i - 1)) * 4
      td[ti]     = r
      td[ti + 1] = g
      td[ti + 2] = b
      td[ti + 3] = 255
    }
  }
  ctx._texture.needsUpdate = true
}

export function teardown(ctx) {
  ctx.remove(ctx._quad)
  ctx._quad.geometry.dispose()
  ctx._quad.material.dispose()
  ctx._texture.dispose()
  ctx.renderer.domElement.removeEventListener('mousemove', ctx._onMouseMove)
  ctx.renderer.domElement.removeEventListener('mousedown', ctx._onMouseDown)
  ctx.renderer.domElement.removeEventListener('mouseup', ctx._onMouseUp)
}

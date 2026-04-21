// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('three', async () => await vi.importActual('three'))

// Stub canvas 2D context — jsdom does not implement CanvasRenderingContext2D
const fakeImageData = { data: new Uint8ClampedArray(96 * 96 * 4) }
const fake2DCtx = {
  createImageData: vi.fn(() => fakeImageData),
  putImageData: vi.fn(),
}
HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
  if (type === '2d') return fake2DCtx
  return null
})

import {
  IX, addSource, setBnd, diffuse, advect, project, mapColor,
  setup, update, teardown, N, SIZE, TOTAL,
} from './fluid-2d.js'

function makeCtx(overrides = {}) {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  return {
    scene: { background: null },
    camera: { position: { set: vi.fn() }, lookAt: vi.fn() },
    renderer: { domElement: canvas },
    add: vi.fn(),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

// ── Solver Unit Tests ──────────────────────────────────────────────────────

describe('fluid solver', () => {
  it('IX maps 2D to 1D correctly', () => {
    expect(IX(0, 0)).toBe(0)
    expect(IX(1, 0)).toBe(1)
    expect(IX(0, 1)).toBe(SIZE)
    expect(IX(3, 5)).toBe(3 + 5 * SIZE)
  })

  it('addSource accumulates scaled values', () => {
    const x = new Float32Array(TOTAL)
    const s = new Float32Array(TOTAL)
    s[IX(5, 5)] = 10
    addSource(x, s, 0.5)
    expect(x[IX(5, 5)]).toBeCloseTo(5.0)
    // Other cells remain 0
    expect(x[IX(1, 1)]).toBe(0)
  })

  it('setBnd reflects u-velocity at left/right walls', () => {
    const x = new Float32Array(TOTAL)
    x[IX(1, 5)] = 3.0
    x[IX(N, 5)] = -2.0
    setBnd(1, x)
    expect(x[IX(0, 5)]).toBe(-3.0)      // left wall reflects
    expect(x[IX(N + 1, 5)]).toBe(2.0)   // right wall reflects
  })

  it('setBnd reflects v-velocity at top/bottom walls', () => {
    const x = new Float32Array(TOTAL)
    x[IX(5, 1)] = 4.0
    x[IX(5, N)] = -1.0
    setBnd(2, x)
    expect(x[IX(5, 0)]).toBe(-4.0)      // bottom wall reflects
    expect(x[IX(5, N + 1)]).toBe(1.0)   // top wall reflects
  })

  it('diffuse smooths a spike towards neighbors', () => {
    const x = new Float32Array(TOTAL)
    const x0 = new Float32Array(TOTAL)
    // Place a spike in center
    x0[IX(N / 2, N / 2)] = 100
    diffuse(0, x, x0, 0.1, 0.1)
    // Center should still be highest but less than original
    const center = x[IX(N / 2, N / 2)]
    expect(center).toBeGreaterThan(0)
    expect(center).toBeLessThan(100)
    // Neighbors should have picked up some value
    expect(x[IX(N / 2 + 1, N / 2)]).toBeGreaterThan(0)
    expect(x[IX(N / 2, N / 2 + 1)]).toBeGreaterThan(0)
  })

  it('diffuse preserves approximate mass', () => {
    const x = new Float32Array(TOTAL)
    const x0 = new Float32Array(TOTAL)
    // Uniform field with small diffusion coefficient
    for (let j = 1; j <= N; j++)
      for (let i = 1; i <= N; i++) x0[IX(i, j)] = 1.0
    setBnd(0, x0)
    // Use small diff so a = dt*diff*N*N stays manageable
    diffuse(0, x, x0, 0.00001, 0.1)
    // Each interior cell should stay near 1.0 (diffusion of uniform = uniform)
    const center = x[IX(N / 2, N / 2)]
    expect(center).toBeCloseTo(1.0, 1)
  })

  it('advect moves density in velocity direction', () => {
    const d = new Float32Array(TOTAL)
    const d0 = new Float32Array(TOTAL)
    const u = new Float32Array(TOTAL)
    const v = new Float32Array(TOTAL)
    // Place a blob of density around center
    const cx = N / 2, cy = N / 2
    for (let dj = -3; dj <= 3; dj++)
      for (let di = -3; di <= 3; di++)
        d0[IX(cx + di, cy + dj)] = 1.0
    // Small rightward velocity — dt0 = dt*N = 0.01*96 = 0.96 cells of backtrack
    for (let j = 0; j < SIZE; j++)
      for (let i = 0; i < SIZE; i++) u[IX(i, j)] = 1.0
    advect(0, d, d0, u, v, 0.01)
    // Density should shift right: cell just right of blob should now have density
    // (cx+4, cy) backtracks ~0.96 cells to (cx+3.04, cy) which is in the blob
    expect(d[IX(cx + 4, cy)]).toBeGreaterThan(0)
    // And left edge of blob should have less density than center
    expect(d[IX(cx - 3, cy)]).toBeLessThan(d[IX(cx, cy)])
  })

  it('project makes velocity field divergence-free', () => {
    const u = new Float32Array(TOTAL)
    const v = new Float32Array(TOTAL)
    const p = new Float32Array(TOTAL)
    const div = new Float32Array(TOTAL)
    // Create a simple divergent field: u increases with i
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        u[IX(i, j)] = i * 0.01
        v[IX(i, j)] = 0
      }
    }
    setBnd(1, u); setBnd(2, v)
    project(u, v, p, div)
    // After projection, measure divergence well inside the domain
    const margin = 10
    let divAfter = 0
    for (let j = margin; j <= N - margin; j++) {
      for (let i = margin; i <= N - margin; i++) {
        const d = (u[IX(i + 1, j)] - u[IX(i - 1, j)] + v[IX(i, j + 1)] - v[IX(i, j - 1)]) * 0.5
        divAfter += Math.abs(d)
      }
    }
    const cells = (N - 2 * margin + 1) ** 2
    const avgDiv = divAfter / cells
    // Average divergence per cell should be very small
    expect(avgDiv).toBeLessThan(0.02)
  })
})

// ── Color Mapping Tests ────────────────────────────────────────────────────

describe('mapColor', () => {
  it('returns black-ish for zero density', () => {
    const [r, g, b] = mapColor(0, 'fire')
    expect(r + g + b).toBeLessThan(100)
  })

  it('returns bright values for high density', () => {
    const [r, g, b] = mapColor(1, 'fire')
    expect(r + g + b).toBeGreaterThan(300)
  })

  it('clamps values to [0, 255]', () => {
    for (const name of ['fire', 'ocean', 'neon']) {
      for (const val of [0, 0.25, 0.5, 0.75, 1.0, 2.0]) {
        const [r, g, b] = mapColor(val, name)
        expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(255)
        expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(255)
        expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(255)
      }
    }
  })

  it('ocean palette has blue dominance', () => {
    const [r, g, b] = mapColor(0.5, 'ocean')
    expect(b).toBeGreaterThan(r)
  })
})

// ── Integration (setup/update/teardown) ────────────────────────────────────

describe('fluid-2d lifecycle', () => {
  let ctx

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = makeCtx()
  })

  it('setup runs without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
  })

  it('setup adds plane and light, enables bloom', () => {
    setup(ctx)
    expect(ctx.add).toHaveBeenCalledTimes(2)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.6)
  })

  it('setup creates a canvas texture via 2D context', () => {
    setup(ctx)
    expect(fake2DCtx.createImageData).toHaveBeenCalledWith(N, N)
  })

  it('update runs without throwing', () => {
    setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('update writes pixel data', () => {
    setup(ctx)
    update(ctx, 0.016)
    expect(fake2DCtx.putImageData).toHaveBeenCalled()
  })

  it('update runs multiple frames stably', () => {
    setup(ctx)
    expect(() => {
      for (let i = 0; i < 5; i++) {
        ctx.elapsed = i * 0.016
        update(ctx, 0.016)
      }
    }).not.toThrow()
  })

  it('teardown removes exactly as many objects as setup added', () => {
    setup(ctx)
    const addCount = ctx.add.mock.calls.length
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(addCount)
  })

  it('teardown restores scene background', () => {
    const original = { isColor: true }
    ctx.scene.background = original
    setup(ctx)
    teardown(ctx)
    expect(ctx.scene.background).toBe(original)
  })
})

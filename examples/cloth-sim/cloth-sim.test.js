// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// ── Mock ctx ──────────────────────────────────────────────────────────────────

function makeMockCtx(overrides = {}) {
  const scene = {
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
  }
  const camera = {
    position: new Three.Vector3(0, 0, 50),
    lookAt: vi.fn(),
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
    fov: 60,
  }
  const controls = {
    update: vi.fn(),
    enableDamping: true,
    target: new Three.Vector3(),
  }
  const canvas = document.createElement('canvas')
  // Provide a minimal getBoundingClientRect
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  const renderer = {
    domElement: canvas,
    setSize: vi.fn(),
    render: vi.fn(),
    shadowMap: { enabled: false },
    toneMapping: 0,
  }

  const ctx = {
    Three,
    scene,
    camera,
    renderer,
    controls,
    labelRenderer: {
      render: vi.fn(),
      setSize: vi.fn(),
      domElement: document.createElement('div'),
    },
    add: vi.fn((obj) => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
  return ctx
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('cloth-sim', () => {
  let ctx
  let setup, update, teardown

  beforeEach(async () => {
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./cloth-sim.js'))
  })

  it('exports setup, update, teardown functions', () => {
    expect(typeof setup).toBe('function')
    expect(typeof update).toBe('function')
    expect(typeof teardown).toBe('function')
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
  })

  it('setup() adds objects to the scene (lights + cloth mesh)', () => {
    setup(ctx)
    // Should add at least: directional light, ambient light, cloth mesh
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('setup() creates particles array on ctx._cloth', () => {
    setup(ctx)
    expect(ctx._cloth).toBeDefined()
    expect(ctx._cloth.particles).toBeDefined()
    expect(ctx._cloth.particles.length).toBe(40 * 40) // 1600 particles
  })

  it('setup() creates constraints on ctx._cloth', () => {
    setup(ctx)
    expect(ctx._cloth.constraints).toBeDefined()
    expect(ctx._cloth.constraints.length).toBeGreaterThan(0)
    // For a 40×40 grid: 40*39 horizontal + 39*40 vertical = 3120
    expect(ctx._cloth.constraints.length).toBe(39 * 40 + 40 * 39)
  })

  it('setup() pins particles along the top row', () => {
    setup(ctx)
    const topRow = ctx._cloth.particles.slice(0, 40)
    const pinnedCount = topRow.filter(p => p.pinned).length
    expect(pinnedCount).toBeGreaterThanOrEqual(2) // at least corners
  })

  it('setup() creates a cloth mesh with PlaneGeometry', () => {
    setup(ctx)
    expect(ctx._cloth.clothMesh).toBeDefined()
    expect(ctx._cloth.geometry).toBeDefined()
    expect(ctx._cloth.clothMesh.material.side).toBe(Three.DoubleSide)
  })

  it('update() runs without throwing', () => {
    setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('update() runs multiple frames without throwing', () => {
    setup(ctx)
    for (let i = 0; i < 10; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('update() moves particles due to gravity', () => {
    setup(ctx)
    // Grab a non-pinned particle's initial Y
    const mid = ctx._cloth.particles[20 * 40 + 20] // middle particle
    const yBefore = mid.pos.y

    // Run several frames
    for (let i = 0; i < 30; i++) {
      ctx.elapsed = i * 0.016
      update(ctx, 0.016)
    }
    const yAfter = mid.pos.y

    // Gravity should pull it down
    expect(yAfter).toBeLessThan(yBefore)
  })

  it('update() updates geometry vertex positions', () => {
    setup(ctx)
    const posAttr = ctx._cloth.geometry.attributes.position
    const yBefore = posAttr.getY(20 * 40 + 20)

    for (let i = 0; i < 20; i++) {
      ctx.elapsed = i * 0.016
      update(ctx, 0.016)
    }
    const yAfter = posAttr.getY(20 * 40 + 20)

    expect(yBefore).not.toBeCloseTo(yAfter, 2)
  })

  it('pinned particles stay in place', () => {
    setup(ctx)
    const pinned = ctx._cloth.particles[0] // top-left corner
    const startY = pinned.pos.y

    for (let i = 0; i < 20; i++) {
      ctx.elapsed = i * 0.016
      update(ctx, 0.016)
    }

    expect(pinned.pos.y).toBeCloseTo(startY, 5)
  })

  it('teardown() does not throw', () => {
    setup(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })

  it('teardown() removes the cloth mesh', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._cloth.clothMesh)
  })
})

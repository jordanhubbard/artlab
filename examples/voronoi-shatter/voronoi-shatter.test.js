// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeCtx(overrides = {}) {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })

  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new THREE.Vector3(0, 0, 50),
    lookAt: vi.fn(), aspect: 1, fov: 60,
    updateProjectionMatrix: vi.fn(),
  }
  return {
    Three: THREE, scene, camera,
    renderer: { domElement: canvas, shadowMap: { enabled: false }, setSize: vi.fn() },
    controls: { update: vi.fn(), target: new THREE.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('voronoi-shatter', () => {
  let ctx, mod

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeCtx()
    mod = await import('./voronoi-shatter.js')
  })

  // ── setup / teardown ──────────────────────────────────────────────

  it('setup() completes without throwing', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalledWith(0.5)
  })

  it('setup() sets camera to angled-down position', () => {
    mod.setup(ctx)
    expect(ctx.camera.position.y).toBeGreaterThan(10)
    expect(ctx.camera.lookAt).toHaveBeenCalled()
  })

  it('setup() creates internal state object', () => {
    mod.setup(ctx)
    expect(ctx._vs).toBeDefined()
    expect(ctx._vs.seeds).toEqual([])
    expect(ctx._vs.shattered).toBe(false)
  })

  it('teardown() cleans up without throwing', () => {
    mod.setup(ctx)
    const removeSpy = vi.spyOn(ctx.renderer.domElement, 'removeEventListener')
    expect(() => mod.teardown(ctx)).not.toThrow()
    expect(removeSpy).toHaveBeenCalledWith('click', ctx._onClick)
    expect(removeSpy).toHaveBeenCalledWith('dblclick', ctx._onDblClick)
    expect(ctx.remove).toHaveBeenCalled()
  })

  it('teardown() nullifies state', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(ctx._vs).toBeNull()
  })

  it('teardown() is safe to call twice', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  // ── update ────────────────────────────────────────────────────────

  it('update() runs without throwing (no seeds)', () => {
    mod.setup(ctx)
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('update() handles missing state gracefully', () => {
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('update() animates shattered cells', () => {
    mod.setup(ctx)
    // Manually force shatter state with a fake cell
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
    mesh.position.set(1, 2, 0)
    ctx._vs.shattered = true
    ctx._vs.cellPhysics = [{ mesh, vx: 1, vy: 5, vz: 0, rx: 1, ry: 0, rz: 0 }]
    mod.update(ctx, 0.016)
    expect(mesh.position.y).not.toBe(2)
  })

  // ── Voronoi algorithm ─────────────────────────────────────────────

  it('computeVoronoiCells assigns nearest seed to each grid cell', () => {
    const seeds = [{ x: -3, y: 0 }, { x: 3, y: 0 }]
    const { grid } = mod.computeVoronoiCells(seeds, 12, 10)
    // left side should be seed 0, right side seed 1
    expect(grid[5][0]).toBe(0) // far left
    expect(grid[5][9]).toBe(1) // far right
  })

  it('computeVoronoiCells handles single seed', () => {
    const seeds = [{ x: 0, y: 0 }]
    const { grid } = mod.computeVoronoiCells(seeds, 12, 5)
    // all cells should be 0
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++)
        expect(grid[r][c]).toBe(0)
  })

  it('extractCellShapes returns one hull per seed', () => {
    const seeds = [{ x: -2, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }]
    const hulls = mod.extractCellShapes(seeds, 12, 60)
    expect(hulls.length).toBe(3)
    hulls.forEach(h => {
      expect(h).not.toBeNull()
      expect(h.length).toBeGreaterThanOrEqual(3)
    })
  })

  // ── convexHull2D ──────────────────────────────────────────────────

  it('convexHull2D computes correct hull for square', () => {
    const pts = [
      new THREE.Vector2(0, 0), new THREE.Vector2(1, 0),
      new THREE.Vector2(1, 1), new THREE.Vector2(0, 1),
      new THREE.Vector2(0.5, 0.5), // interior point
    ]
    const hull = mod.convexHull2D(pts)
    expect(hull.length).toBe(4) // four corners
  })

  it('convexHull2D handles collinear points', () => {
    const pts = [
      new THREE.Vector2(0, 0), new THREE.Vector2(1, 0),
      new THREE.Vector2(2, 0), new THREE.Vector2(1, 1),
    ]
    const hull = mod.convexHull2D(pts)
    expect(hull.length).toBeGreaterThanOrEqual(3)
  })

  // ── buildCellMesh ─────────────────────────────────────────────────

  it('buildCellMesh creates a valid mesh', () => {
    const hull = [
      new THREE.Vector2(0, 0), new THREE.Vector2(1, 0),
      new THREE.Vector2(1, 1), new THREE.Vector2(0, 1),
    ]
    const seed = { x: 0.5, y: 0.5 }
    const mesh = mod.buildCellMesh(hull, seed, 0, 5)
    expect(mesh).toBeInstanceOf(THREE.Mesh)
    expect(mesh.geometry).toBeInstanceOf(THREE.ExtrudeGeometry)
    expect(mesh.position.x).toBeCloseTo(0.5)
  })
})

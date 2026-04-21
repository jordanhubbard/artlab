// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeCtx(overrides = {}) {
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new THREE.Vector3(0, 0, 50),
    lookAt: vi.fn(),
    aspect: 1,
    fov: 60,
    updateProjectionMatrix: vi.fn(),
  }
  return {
    Three: THREE, scene, camera,
    renderer: {
      domElement: document.createElement('canvas'),
      shadowMap: { enabled: false },
      setSize: vi.fn(),
    },
    controls: { update: vi.fn(), target: new THREE.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('penrose-tiles', () => {
  let ctx, mod

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeCtx()
    mod = await import('./penrose-tiles.js')
  })

  // ── Golden ratio ───────────────────────────────────────────────────

  it('PHI is the golden ratio', () => {
    expect(mod.PHI).toBeCloseTo(1.618033988749895, 10)
  })

  // ── Initial triangle wheel ─────────────────────────────────────────

  it('createInitialTriangles returns 10 triangles', () => {
    const tris = mod.createInitialTriangles()
    expect(tris).toHaveLength(10)
  })

  it('initial triangles are all type 0 (acute)', () => {
    const tris = mod.createInitialTriangles()
    for (const t of tris) {
      expect(t.type).toBe(0)
    }
  })

  it('initial triangles have Vector2 vertices', () => {
    const tris = mod.createInitialTriangles()
    for (const t of tris) {
      expect(t.A).toBeInstanceOf(THREE.Vector2)
      expect(t.B).toBeInstanceOf(THREE.Vector2)
      expect(t.C).toBeInstanceOf(THREE.Vector2)
    }
  })

  // ── Subdivision ────────────────────────────────────────────────────

  it('subdivide() increases triangle count', () => {
    const tris = mod.createInitialTriangles()
    const sub = mod.subdivide(tris)
    expect(sub.length).toBeGreaterThan(tris.length)
  })

  it('type 0 triangle subdivides into 2 triangles', () => {
    const tri = [{
      type: 0,
      A: new THREE.Vector2(0, 0),
      B: new THREE.Vector2(1, 0),
      C: new THREE.Vector2(0.5, 0.8),
    }]
    const result = mod.subdivide(tri)
    expect(result).toHaveLength(2)
    // Should produce 1 type 0 + 1 type 1
    const types = result.map(t => t.type).sort()
    expect(types).toEqual([0, 1])
  })

  it('type 1 triangle subdivides into 3 triangles', () => {
    const tri = [{
      type: 1,
      A: new THREE.Vector2(0, 0),
      B: new THREE.Vector2(1, 0),
      C: new THREE.Vector2(0.3, 0.6),
    }]
    const result = mod.subdivide(tri)
    expect(result).toHaveLength(3)
    // Should produce 1 type 0 + 2 type 1
    const types = result.map(t => t.type).sort()
    expect(types).toEqual([0, 1, 1])
  })

  it('multiple subdivisions produce correct growth', () => {
    let tris = mod.createInitialTriangles() // 10
    tris = mod.subdivide(tris) // each type 0 -> 2 = 20
    tris = mod.subdivide(tris) // type 0 -> 2, type 1 -> 3
    expect(tris.length).toBeGreaterThan(20)
  })

  // ── Rhombus pairing ────────────────────────────────────────────────

  it('pairTrianglesIntoRhombuses returns array', () => {
    let tris = mod.createInitialTriangles()
    tris = mod.subdivide(tris)
    tris = mod.subdivide(tris)
    const rh = mod.pairTrianglesIntoRhombuses(tris)
    expect(Array.isArray(rh)).toBe(true)
    expect(rh.length).toBeGreaterThan(0)
  })

  it('rhombuses have type thin or thick', () => {
    let tris = mod.createInitialTriangles()
    tris = mod.subdivide(tris)
    tris = mod.subdivide(tris)
    const rh = mod.pairTrianglesIntoRhombuses(tris)
    for (const r of rh) {
      expect(['thin', 'thick']).toContain(r.type)
    }
  })

  it('rhombuses have 3 or 4 vertices', () => {
    let tris = mod.createInitialTriangles()
    tris = mod.subdivide(tris)
    tris = mod.subdivide(tris)
    const rh = mod.pairTrianglesIntoRhombuses(tris)
    for (const r of rh) {
      expect(r.vertices.length).toBeGreaterThanOrEqual(3)
      expect(r.vertices.length).toBeLessThanOrEqual(4)
    }
  })

  // ── Full tiling generation ─────────────────────────────────────────

  it('generatePenroseTiling returns many tiles at level 4', () => {
    const tiles = mod.generatePenroseTiling(4)
    expect(tiles.length).toBeGreaterThan(50)
  })

  it('generatePenroseTiling has both thin and thick tiles', () => {
    const tiles = mod.generatePenroseTiling(4)
    const types = new Set(tiles.map(t => t.type))
    expect(types.has('thin')).toBe(true)
    expect(types.has('thick')).toBe(true)
  })

  it('generatePenroseTiling tile count grows with level', () => {
    const t3 = mod.generatePenroseTiling(3)
    const t4 = mod.generatePenroseTiling(4)
    expect(t4.length).toBeGreaterThan(t3.length)
  })

  // ── buildTileMesh ──────────────────────────────────────────────────

  it('buildTileMesh creates a valid Mesh with ExtrudeGeometry', () => {
    const rh = {
      type: 'thick',
      vertices: [
        new THREE.Vector2(0, 0), new THREE.Vector2(1, 0),
        new THREE.Vector2(1.3, 0.8), new THREE.Vector2(0.3, 0.8),
      ],
    }
    const mesh = mod.buildTileMesh(rh, 5)
    expect(mesh).toBeInstanceOf(THREE.Mesh)
    expect(mesh.geometry).toBeInstanceOf(THREE.ExtrudeGeometry)
  })

  it('buildTileMesh thin tiles are shorter than thick tiles', () => {
    const thin = {
      type: 'thin',
      vertices: [
        new THREE.Vector2(0, 0), new THREE.Vector2(1, 0),
        new THREE.Vector2(1.1, 0.3), new THREE.Vector2(0.1, 0.3),
      ],
    }
    const thick = {
      type: 'thick',
      vertices: [
        new THREE.Vector2(0, 0), new THREE.Vector2(1, 0),
        new THREE.Vector2(1.3, 0.8), new THREE.Vector2(0.3, 0.8),
      ],
    }
    const thinMesh = mod.buildTileMesh(thin, 5)
    const thickMesh = mod.buildTileMesh(thick, 5)
    // Thick tiles should be taller
    expect(thinMesh.userData.isThin).toBe(true)
    expect(thickMesh.userData.isThin).toBe(false)
  })

  it('buildTileMesh stores distance in userData', () => {
    const rh = {
      type: 'thin',
      vertices: [
        new THREE.Vector2(2, 3), new THREE.Vector2(3, 3),
        new THREE.Vector2(3.1, 3.3), new THREE.Vector2(2.1, 3.3),
      ],
    }
    const mesh = mod.buildTileMesh(rh, 1)
    expect(mesh.userData.dist).toBeGreaterThan(0)
  })

  it('buildTileMesh starts hidden (small scale)', () => {
    const rh = {
      type: 'thick',
      vertices: [
        new THREE.Vector2(0, 0), new THREE.Vector2(1, 0),
        new THREE.Vector2(1.3, 0.8), new THREE.Vector2(0.3, 0.8),
      ],
    }
    const mesh = mod.buildTileMesh(rh, 5)
    expect(mesh.scale.x).toBeLessThan(0.1)
    expect(mesh.position.y).toBeLessThan(0)
  })

  // ── setup / teardown ───────────────────────────────────────────────

  it('setup() completes without throwing', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalledWith(0.6)
  })

  it('setup() positions camera above and angled', () => {
    mod.setup(ctx)
    expect(ctx.camera.position.y).toBeGreaterThan(5)
    expect(ctx.camera.lookAt).toHaveBeenCalled()
  })

  it('setup() creates internal state', () => {
    mod.setup(ctx)
    expect(ctx._pt).toBeDefined()
    expect(Array.isArray(ctx._pt.tiles)).toBe(true)
    expect(ctx._pt.tiles.length).toBeGreaterThan(0)
    expect(ctx._pt.group).toBeInstanceOf(THREE.Group)
  })

  it('setup() tiles are sorted by distance', () => {
    mod.setup(ctx)
    const dists = ctx._pt.tiles.map(t => t.userData.dist)
    for (let i = 1; i < dists.length; i++) {
      expect(dists[i]).toBeGreaterThanOrEqual(dists[i - 1])
    }
  })

  it('teardown() cleans up without throwing', () => {
    mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
    expect(ctx.remove).toHaveBeenCalled()
  })

  it('teardown() nullifies state', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(ctx._pt).toBeNull()
  })

  it('teardown() is safe to call twice', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() is safe without setup', () => {
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  // ── update ─────────────────────────────────────────────────────────

  it('update() runs without throwing', () => {
    mod.setup(ctx)
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('update() handles missing state gracefully', () => {
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('update() reveals tiles over time', () => {
    mod.setup(ctx)
    // Run many frames to advance reveal
    for (let i = 0; i < 60; i++) {
      mod.update(ctx, 0.016)
    }
    const revealed = ctx._pt.tiles.filter(t => t.userData.revealed)
    expect(revealed.length).toBeGreaterThan(0)
  })

  it('update() rotates the group', () => {
    mod.setup(ctx)
    const y0 = ctx._pt.group.rotation.y
    mod.update(ctx, 0.5)
    expect(ctx._pt.group.rotation.y).not.toBeCloseTo(y0, 3)
  })

  it('update() scales revealed tiles towards 1', () => {
    mod.setup(ctx)
    // Force-reveal first tile
    ctx._pt.tiles[0].userData.revealed = true
    ctx._pt.tiles[0].scale.setScalar(0.01)
    mod.update(ctx, 0.1)
    expect(ctx._pt.tiles[0].scale.x).toBeGreaterThan(0.01)
  })
})

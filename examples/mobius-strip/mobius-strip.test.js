// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// ── Mock ctx ────────────────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  const scene = {
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
    background: null,
  }
  const camera = {
    position: new THREE.Vector3(0, 0, 50),
    lookAt: vi.fn(),
    aspect: 1,
    fov: 60,
    updateProjectionMatrix: vi.fn(),
  }
  return {
    Three: THREE,
    scene,
    camera,
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

// ── Tests ───────────────────────────────────────────────────────────────────

describe('mobius-strip', () => {
  let ctx, mod

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeCtx()
    mod = await import('./mobius-strip.js')
  })

  // ── Parametric helpers ────────────────────────────────────────────

  it('mobiusPoint returns a Vector3', () => {
    const p = mod.mobiusPoint(0, 0)
    expect(p).toBeInstanceOf(THREE.Vector3)
  })

  it('mobiusPoint(0, 0) lies at (R, 0, 0)', () => {
    const p = mod.mobiusPoint(0, 0)
    expect(p.x).toBeCloseTo(3, 4) // R = 3
    expect(p.y).toBeCloseTo(0, 4)
    expect(p.z).toBeCloseTo(0, 4)
  })

  it('mobiusPoint at t=π, s=0 lies at (-R, 0, 0)', () => {
    const p = mod.mobiusPoint(Math.PI, 0)
    expect(p.x).toBeCloseTo(-3, 4)
    expect(p.y).toBeCloseTo(0, 1) // sin(π) ≈ 0
    expect(p.z).toBeCloseTo(0, 4)
  })

  it('mobiusPoint with nonzero s gives offset from center', () => {
    const center = mod.mobiusPoint(0, 0)
    const edge = mod.mobiusPoint(0, 0.5)
    expect(edge.x).not.toBeCloseTo(center.x, 2)
  })

  // ── Geometry builder ──────────────────────────────────────────────

  it('buildMobiusGeometry returns a BufferGeometry with position, color, normal', () => {
    const geo = mod.buildMobiusGeometry()
    expect(geo).toBeInstanceOf(THREE.BufferGeometry)
    expect(geo.getAttribute('position')).toBeDefined()
    expect(geo.getAttribute('color')).toBeDefined()
    expect(geo.getAttribute('normal')).toBeDefined()
    expect(geo.index).not.toBeNull()
  })

  it('buildMobiusGeometry has correct vertex count', () => {
    const geo = mod.buildMobiusGeometry()
    const posAttr = geo.getAttribute('position')
    // (SEG_T+1) * (SEG_S+1) = 201 * 13 = 2613 vertices
    expect(posAttr.count).toBe(201 * 13)
  })

  // ── Marble position ───────────────────────────────────────────────

  it('marblePosition returns a Vector3', () => {
    const p = mod.marblePosition(0)
    expect(p).toBeInstanceOf(THREE.Vector3)
  })

  it('marblePosition at phase=0 is near (R, 0, 0)', () => {
    const p = mod.marblePosition(0)
    expect(p.x).toBeCloseTo(3, 1)
    expect(p.y).toBeCloseTo(0, 1)
  })

  it('marblePosition at 2π vs 0 are on opposite sides of strip', () => {
    // At phase=0, marble is at s=+offset; at phase=2π, s=-offset
    const p0 = mod.marblePosition(0)
    const p2 = mod.marblePosition(Math.PI * 2)
    // Both should be near (R, 0, 0) but the tiny offset differs in sign
    expect(p0.x).toBeCloseTo(p2.x, 1)
    // At t=0 for both, but s differs in sign → x differs slightly
    expect(Math.abs(p0.x - p2.x)).toBeLessThan(0.1)
  })

  it('marble returns to approximately the same position after 4π', () => {
    const p0 = mod.marblePosition(0)
    const p4 = mod.marblePosition(Math.PI * 4 - 0.0001) // just before wrapping
    expect(p0.x).toBeCloseTo(p4.x, 0)
    expect(p0.z).toBeCloseTo(p4.z, 0)
  })

  // ── setup ─────────────────────────────────────────────────────────

  it('setup() completes without throwing', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() enables bloom', () => {
    mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.6)
  })

  it('setup() sets dark background', () => {
    mod.setup(ctx)
    expect(ctx.scene.background).toBeInstanceOf(THREE.Color)
  })

  it('setup() creates internal state with expected keys', () => {
    mod.setup(ctx)
    expect(ctx._mob).toBeDefined()
    expect(ctx._mob.pivot).toBeInstanceOf(THREE.Group)
    expect(ctx._mob.marble).toBeInstanceOf(THREE.Mesh)
    expect(ctx._mob.trail).toBeInstanceOf(THREE.Line)
    expect(ctx._mob.stripMesh).toBeInstanceOf(THREE.Mesh)
    expect(typeof ctx._mob.phase).toBe('number')
  })

  it('setup() positions camera above and back', () => {
    mod.setup(ctx)
    expect(ctx.camera.position.y).toBeGreaterThan(0)
    expect(ctx.camera.position.z).toBeGreaterThan(0)
    expect(ctx.camera.lookAt).toHaveBeenCalled()
  })

  // ── update ────────────────────────────────────────────────────────

  it('update() runs without throwing', () => {
    mod.setup(ctx)
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('update() handles missing state gracefully', () => {
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('update() advances marble phase', () => {
    mod.setup(ctx)
    const before = ctx._mob.phase
    mod.update(ctx, 0.5)
    expect(ctx._mob.phase).toBeGreaterThan(before)
  })

  it('update() moves the marble position', () => {
    mod.setup(ctx)
    const pos0 = ctx._mob.marble.position.clone()
    ctx.elapsed = 1.0
    mod.update(ctx, 1.0)
    const pos1 = ctx._mob.marble.position.clone()
    expect(pos0.distanceTo(pos1)).toBeGreaterThan(0.01)
  })

  it('update() rotates the pivot', () => {
    mod.setup(ctx)
    const rot0 = ctx._mob.pivot.rotation.y
    ctx.elapsed = 0.5
    mod.update(ctx, 0.5)
    expect(ctx._mob.pivot.rotation.y).not.toBeCloseTo(rot0, 4)
  })

  it('update() wraps phase past 4π', () => {
    mod.setup(ctx)
    ctx._mob.phase = Math.PI * 4 - 0.01
    mod.update(ctx, 0.1)
    // Phase should wrap around
    expect(ctx._mob.phase).toBeLessThan(Math.PI * 4)
  })

  it('update() marks trail buffers for GPU upload', () => {
    mod.setup(ctx)
    const posBefore = ctx._mob.trail.geometry.attributes.position.version
    const colBefore = ctx._mob.trail.geometry.attributes.color.version
    mod.update(ctx, 0.016)
    expect(ctx._mob.trail.geometry.attributes.position.version).toBeGreaterThan(posBefore)
    expect(ctx._mob.trail.geometry.attributes.color.version).toBeGreaterThan(colBefore)
  })

  // ── teardown ──────────────────────────────────────────────────────

  it('teardown() cleans up without throwing', () => {
    mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
    expect(ctx.remove).toHaveBeenCalled()
    expect(ctx._mob).toBeNull()
  })

  it('teardown() is safe to call when state is absent', () => {
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() disposes geometries and materials', () => {
    mod.setup(ctx)
    const stripGeoDispose = vi.spyOn(ctx._mob.stripMesh.geometry, 'dispose')
    const stripMatDispose = vi.spyOn(ctx._mob.stripMesh.material, 'dispose')
    const marbleGeoDispose = vi.spyOn(ctx._mob.marble.geometry, 'dispose')
    mod.teardown(ctx)
    expect(stripGeoDispose).toHaveBeenCalled()
    expect(stripMatDispose).toHaveBeenCalled()
    expect(marbleGeoDispose).toHaveBeenCalled()
  })

  // ── Multiple frames stress test ───────────────────────────────────

  it('survives 100 update frames', () => {
    mod.setup(ctx)
    for (let i = 0; i < 100; i++) {
      ctx.elapsed = i * 0.016
      expect(() => mod.update(ctx, 0.016)).not.toThrow()
    }
  })
})

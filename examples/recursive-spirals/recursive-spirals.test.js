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

describe('recursive-spirals', () => {
  let ctx, mod

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeCtx()
    mod = await import('./recursive-spirals.js')
  })

  // ── Constants ───────────────────────────────────────────────────────

  it('PHI is the golden ratio', () => {
    expect(mod.PHI).toBeCloseTo(1.618033988749895, 10)
  })

  it('GOLDEN_ANGLE is approximately 2.399 radians (~137.5°)', () => {
    expect(mod.GOLDEN_ANGLE).toBeCloseTo(2.39996, 3)
    // Convert to degrees and check
    const degrees = (mod.GOLDEN_ANGLE * 180) / Math.PI
    expect(degrees).toBeCloseTo(137.507, 1)
  })

  // ── Spiral generation ─────────────────────────────────────────────

  it('generateSpiral returns an array of circle descriptors', () => {
    const circles = mod.generateSpiral(0, 0, 4, 0, 0)
    expect(Array.isArray(circles)).toBe(true)
    expect(circles.length).toBeGreaterThan(0)
  })

  it('generateSpiral first circle is at origin with given radius', () => {
    const circles = mod.generateSpiral(0, 0, 4, 0, 0)
    expect(circles[0].x).toBe(0)
    expect(circles[0].y).toBe(0)
    expect(circles[0].radius).toBe(4)
    expect(circles[0].depth).toBe(0)
  })

  it('generateSpiral circles have decreasing radius with depth', () => {
    const circles = mod.generateSpiral(0, 0, 4, 0, 0)
    const depths = new Map()
    for (const c of circles) {
      if (!depths.has(c.depth)) depths.set(c.depth, [])
      depths.get(c.depth).push(c.radius)
    }
    const avgByDepth = [...depths.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, radii]) => radii.reduce((a, b) => a + b, 0) / radii.length)
    for (let i = 1; i < avgByDepth.length; i++) {
      expect(avgByDepth[i]).toBeLessThan(avgByDepth[i - 1])
    }
  })

  it('generateSpiral produces circles at multiple depth levels', () => {
    const circles = mod.generateSpiral(0, 0, 4, 0, 0)
    const depths = new Set(circles.map(c => c.depth))
    expect(depths.size).toBeGreaterThanOrEqual(5)
  })

  it('generateSpiral circles have hue between 0 and 1', () => {
    const circles = mod.generateSpiral(0, 0, 4, 0, 0)
    for (const c of circles) {
      expect(c.hue).toBeGreaterThanOrEqual(0)
      expect(c.hue).toBeLessThan(1)
    }
  })

  it('generateSpiral z increases with depth', () => {
    const circles = mod.generateSpiral(0, 0, 4, 0, 0)
    const depth0 = circles.find(c => c.depth === 0)
    const depth3 = circles.find(c => c.depth === 3)
    expect(depth3.z).toBeGreaterThan(depth0.z)
  })

  it('generateSpiral stops at small radius', () => {
    const circles = mod.generateSpiral(0, 0, 0.01, 0, 0)
    expect(circles.length).toBe(0)
  })

  // ── countCircles ──────────────────────────────────────────────────

  it('countCircles returns a positive integer', () => {
    const count = mod.countCircles(0, 4)
    expect(count).toBeGreaterThan(0)
    expect(Number.isInteger(count)).toBe(true)
  })

  it('countCircles matches generateSpiral length', () => {
    const count = mod.countCircles(0, 4)
    const circles = mod.generateSpiral(0, 0, 4, 0, 0)
    expect(circles.length).toBe(count)
  })

  it('countCircles returns 0 for tiny radius', () => {
    expect(mod.countCircles(0, 0.001)).toBe(0)
  })

  // ── createRingMesh ────────────────────────────────────────────────

  it('createRingMesh returns a THREE.Mesh', () => {
    const circle = { x: 1, y: 2, z: 0.5, radius: 1, depth: 1, index: 3, hue: 0.3 }
    const mesh = mod.createRingMesh(circle)
    expect(mesh).toBeInstanceOf(THREE.Mesh)
  })

  it('createRingMesh uses RingGeometry', () => {
    const circle = { x: 0, y: 0, z: 0, radius: 2, depth: 0, index: 0, hue: 0 }
    const mesh = mod.createRingMesh(circle)
    expect(mesh.geometry).toBeInstanceOf(THREE.RingGeometry)
  })

  it('createRingMesh positions mesh correctly', () => {
    const circle = { x: 3, y: -1, z: 0.7, radius: 1.5, depth: 2, index: 5, hue: 0.6 }
    const mesh = mod.createRingMesh(circle)
    expect(mesh.position.x).toBeCloseTo(3)
    expect(mesh.position.y).toBeCloseTo(-1)
    expect(mesh.position.z).toBeCloseTo(0.7)
  })

  it('createRingMesh starts invisible (opacity 0, small scale)', () => {
    const circle = { x: 0, y: 0, z: 0, radius: 1, depth: 0, index: 0, hue: 0.5 }
    const mesh = mod.createRingMesh(circle)
    expect(mesh.material.opacity).toBe(0)
    expect(mesh.scale.x).toBeLessThan(0.1)
  })

  it('createRingMesh stores userData with circle info', () => {
    const circle = { x: 1, y: 2, z: 0.3, radius: 1, depth: 2, index: 7, hue: 0.4 }
    const mesh = mod.createRingMesh(circle)
    expect(mesh.userData.depth).toBe(2)
    expect(mesh.userData.index).toBe(7)
    expect(mesh.userData.hue).toBeCloseTo(0.4)
    expect(mesh.userData.revealed).toBe(false)
  })

  // ── setup ─────────────────────────────────────────────────────────

  it('setup() completes without throwing', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() enables bloom', () => {
    mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalledWith(1.2)
  })

  it('setup() positions camera at an angle', () => {
    mod.setup(ctx)
    expect(ctx.camera.position.z).toBeGreaterThan(5)
    expect(ctx.camera.lookAt).toHaveBeenCalled()
  })

  it('setup() creates internal state with group and meshes', () => {
    mod.setup(ctx)
    expect(ctx._rs).toBeDefined()
    expect(ctx._rs.group).toBeInstanceOf(THREE.Group)
    expect(Array.isArray(ctx._rs.meshes)).toBe(true)
    expect(ctx._rs.meshes.length).toBeGreaterThan(0)
  })

  it('setup() meshes are children of the group', () => {
    mod.setup(ctx)
    expect(ctx._rs.group.children.length).toBe(ctx._rs.meshes.length)
  })

  // ── update ────────────────────────────────────────────────────────

  it('update() runs without throwing', () => {
    mod.setup(ctx)
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('update() handles missing state gracefully', () => {
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('update() rotates the group over time', () => {
    mod.setup(ctx)
    const z0 = ctx._rs.group.rotation.z
    mod.update(ctx, 0.5)
    expect(ctx._rs.group.rotation.z).not.toBeCloseTo(z0, 3)
  })

  it('update() reveals circles based on elapsed time', () => {
    mod.setup(ctx)
    ctx.elapsed = 7 // past full reveal duration
    for (let i = 0; i < 30; i++) {
      mod.update(ctx, 0.016)
    }
    const revealed = ctx._rs.meshes.filter(m => m.userData.revealed)
    expect(revealed.length).toBeGreaterThan(0)
  })

  it('update() increases opacity of revealed circles', () => {
    mod.setup(ctx)
    ctx.elapsed = 10
    // Force reveal a mesh
    const mesh = ctx._rs.meshes[0]
    mesh.userData.revealed = true
    const opBefore = mesh.material.opacity
    mod.update(ctx, 0.1)
    expect(mesh.material.opacity).toBeGreaterThan(opBefore)
  })

  it('update() scales up revealed circles', () => {
    mod.setup(ctx)
    ctx.elapsed = 10
    const mesh = ctx._rs.meshes[0]
    mesh.userData.revealed = true
    mesh.scale.setScalar(0.01)
    mod.update(ctx, 0.1)
    expect(mesh.scale.x).toBeGreaterThan(0.01)
  })

  // ── teardown ──────────────────────────────────────────────────────

  it('teardown() cleans up without throwing', () => {
    mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
    expect(ctx.remove).toHaveBeenCalled()
  })

  it('teardown() nullifies state', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(ctx._rs).toBeNull()
  })

  it('teardown() is safe to call twice', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() is safe without prior setup', () => {
    expect(() => mod.teardown(ctx)).not.toThrow()
  })
})

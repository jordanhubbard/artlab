// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import { setup, update, teardown } from './fractal-tree.js'

vi.mock('three', async () => await vi.importActual('three'))

// jsdom has no 2D canvas implementation. The example guards against a null
// context, but stubbing keeps texture generation on the same code path the
// browser takes so instance/material counts stay comparable.
HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
  if (type !== '2d') return null
  const gradient = { addColorStop: vi.fn() }
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    fillRect: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
  }
})

function makeCtx(overrides = {}) {
  const scene = { fog: null, background: null, children: [] }
  return {
    Three: THREE,
    scene,
    camera: {
      position: new THREE.Vector3(0, 0, 0),
      lookAt: vi.fn(),
      quaternion: new THREE.Quaternion(),
      updateProjectionMatrix: vi.fn(),
    },
    controls: { enabled: true, target: new THREE.Vector3(), update: vi.fn() },
    renderer: { shadowMap: {}, domElement: document.createElement('canvas') },
    add: vi.fn((obj) => { scene.children.push(obj); return obj }),
    remove: vi.fn((obj) => {
      const i = scene.children.indexOf(obj)
      if (i >= 0) scene.children.splice(i, 1)
    }),
    setBloom: vi.fn(),
    setHelp: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

// Every Object3D reachable from the objects handed to ctx.add().
function addedObjects(ctx) {
  const out = []
  for (const [obj] of ctx.add.mock.calls) obj.traverse((o) => out.push(o))
  return out
}

function instancedByName(ctx, name) {
  return addedObjects(ctx).find(o => o.isInstancedMesh && o.name === name)
}

function canopySignature(ctx) {
  return ctx._oldGrowth.canopy
    .map(m => Array.from(m.instanceMatrix.array).map(v => v.toFixed(4)).join(','))
    .join('|')
}

describe('fractal-tree — Old Growth', () => {
  let ctx

  beforeEach(() => {
    ctx = makeCtx()
  })

  it('calls ctx.setHelp before adding anything to the scene', () => {
    setup(ctx)
    expect(ctx.setHelp).toHaveBeenCalledTimes(1)
    expect(ctx.setHelp.mock.calls[0][0]).toMatch(/\S/)
    expect(ctx.setHelp.mock.invocationCallOrder[0])
      .toBeLessThan(ctx.add.mock.invocationCallOrder[0])
  })

  it('stages fog and a matching background for a forest interior', () => {
    setup(ctx)
    expect(ctx.scene.fog).toBeInstanceOf(THREE.FogExp2)
    expect(ctx.scene.background).toBeInstanceOf(THREE.Color)
    expect(ctx.scene.fog.color.getHex()).toBe(ctx.scene.background.getHex())
    expect(ctx.scene.fog.density).toBeGreaterThan(0.01)
  })

  it('stages the camera at ground level looking up into the canopy', () => {
    setup(ctx)
    expect(ctx.camera.position.y).toBeLessThan(2.5)
    expect(ctx.camera.position.y).toBeGreaterThan(0.5)
    const [, lookY] = ctx.camera.lookAt.mock.calls.at(-1)
    expect(lookY).toBeGreaterThan(5)
    expect(ctx.controls.enabled).toBe(false)
  })

  it('builds a tapered branching hierarchy from a few reusable geometries', () => {
    setup(ctx)
    const { stats, limbs } = ctx._oldGrowth

    expect(limbs.length).toBeGreaterThanOrEqual(4)
    expect(stats.branchCount).toBeGreaterThanOrEqual(240)
    expect(stats.tipRadius).toBeLessThan(stats.trunkRadius * 0.25)

    const geometries = new Set(addedObjects(ctx).filter(o => o.geometry).map(o => o.geometry))
    expect(geometries.size).toBeLessThanOrEqual(12)
  })

  it('flares roots into the floor from one reusable root geometry', () => {
    setup(ctx)
    const roots = instancedByName(ctx, 'old-growth-roots')
    expect(roots).toBeDefined()
    expect(roots.count).toBeGreaterThanOrEqual(12)
    expect(ctx._oldGrowth.stats.rootSpread).toBeGreaterThan(1.5)
  })

  it('fills the canopy with dense instanced leaves carried by the limbs', () => {
    setup(ctx)
    const { canopy, stats } = ctx._oldGrowth
    expect(canopy.length).toBeGreaterThanOrEqual(4)
    for (const cluster of canopy) {
      expect(cluster.isInstancedMesh).toBe(true)
      expect(cluster.count).toBeGreaterThan(0)
    }
    const total = canopy.reduce((n, c) => n + c.count, 0)
    expect(total).toBe(stats.leafCount)
    expect(total).toBeGreaterThanOrEqual(900)
  })

  it('lays a forest floor with understory scatter and dappled light pools', () => {
    setup(ctx)
    const floor = addedObjects(ctx).find(o => o.name === 'forest-floor')
    expect(floor).toBeDefined()
    expect(floor.geometry.parameters.width).toBeGreaterThanOrEqual(80)
    expect(Math.abs(floor.rotation.x + Math.PI / 2)).toBeLessThan(1e-6)
    expect(instancedByName(ctx, 'understory').count).toBeGreaterThanOrEqual(24)
    expect(instancedByName(ctx, 'distant-trunks').count).toBeGreaterThanOrEqual(16)
    expect(ctx._oldGrowth.pools.length).toBeGreaterThanOrEqual(3)
    expect(ctx._oldGrowth.shafts.length).toBeGreaterThanOrEqual(2)
  })

  it('renders a complete first frame with no progressive reveal', () => {
    setup(ctx)
    for (const obj of addedObjects(ctx)) expect(obj.visible).toBe(true)
    for (const cluster of ctx._oldGrowth.canopy) {
      expect(cluster.count).toBe(cluster.instanceMatrix.count)
    }
  })

  it('produces identical geometry for repeated setups', () => {
    setup(ctx)
    const first = canopySignature(ctx)
    const firstStats = { ...ctx._oldGrowth.stats }
    teardown(ctx)

    const ctx2 = makeCtx()
    setup(ctx2)
    expect(canopySignature(ctx2)).toBe(first)
    expect(ctx2._oldGrowth.stats).toEqual(firstStats)
  })

  it('keeps wind restrained and reuses instance buffers every frame', () => {
    setup(ctx)
    const buffers = ctx._oldGrowth.canopy.map(c => c.instanceMatrix.array)

    for (let t = 0; t <= 40; t += 0.5) {
      ctx.elapsed = t
      expect(() => update(ctx, 1 / 60)).not.toThrow()
      for (const limb of ctx._oldGrowth.limbs) {
        expect(Math.abs(limb.wind.rotation.z)).toBeLessThan(0.06)
        expect(Math.abs(limb.wind.rotation.x)).toBeLessThan(0.06)
      }
      expect(ctx.camera.position.y).toBeLessThan(2.5)
    }

    ctx._oldGrowth.canopy.forEach((c, i) => {
      expect(c.instanceMatrix.array).toBe(buffers[i])
    })
  })

  it('animates the dappled pools over time', () => {
    setup(ctx)
    const before = ctx._oldGrowth.pools.map(p => p.material.opacity)
    ctx.elapsed = 7.3
    update(ctx, 1 / 60)
    const after = ctx._oldGrowth.pools.map(p => p.material.opacity)
    expect(after).not.toEqual(before)
    for (const opacity of after) {
      expect(opacity).toBeGreaterThan(0)
      expect(opacity).toBeLessThanOrEqual(1)
    }
  })

  it('teardown removes every added object and disposes its resources', () => {
    setup(ctx)
    const addCount = ctx.add.mock.calls.length
    const spies = []
    for (const obj of addedObjects(ctx)) {
      if (obj.geometry) spies.push(vi.spyOn(obj.geometry, 'dispose'))
      if (obj.material) spies.push(vi.spyOn(obj.material, 'dispose'))
    }

    teardown(ctx)

    expect(ctx.remove).toHaveBeenCalledTimes(addCount)
    expect(ctx.scene.children).toHaveLength(0)
    expect(spies.length).toBeGreaterThan(0)
    for (const spy of spies) expect(spy).toHaveBeenCalled()
  })

  it('teardown restores scene and controls state and is idempotent', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.scene.fog).toBeNull()
    expect(ctx.scene.background).toBeNull()
    expect(ctx.controls.enabled).toBe(true)
    expect(ctx._oldGrowth).toBeUndefined()
    expect(() => teardown(ctx)).not.toThrow()
    expect(() => update(ctx, 1 / 60)).not.toThrow()
  })
})

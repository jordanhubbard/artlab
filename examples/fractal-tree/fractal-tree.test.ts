// @vitest-environment jsdom
import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { canvas2D, initialize, makeSpiedContext, mockCanvas2D, required } from '../../tests/context.ts'
import { setup, teardown, update } from './fractal-tree.ts'
type Demo = typeof import('./fractal-tree.ts')

vi.mock('three', async () => await vi.importActual('three'))

// jsdom has no 2D canvas implementation. The example guards against a null
// context, but stubbing keeps texture generation on the same code path the
// browser takes so instance/material counts stay comparable.
mockCanvas2D(() => {
  const gradient = { addColorStop: vi.fn() }
  return canvas2D({
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    fillRect: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
  })
})

// Every Object3D reachable from the objects handed to ctx.add().
function addedObjects(ctx: DemoContext<Demo>) {
  const out: THREE.Object3D[] = []
  for (const [obj] of ctx.add.mock.calls) obj.traverse((o) => out.push(o))
  return out
}

function instancedByName(ctx: DemoContext<Demo>, name: string) {
  return required(addedObjects(ctx).find((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh && o.name === name))
}

function canopySignature(ctx: DemoContext<Demo>) {
  return required(ctx._oldGrowth).canopy
    .map(m => Array.from(m.instanceMatrix.array).map(v => v.toFixed(4)).join(','))
    .join('|')
}

describe('fractal-tree — Old Growth', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>

  beforeEach(() => {
    base = makeSpiedContext()
  })

  it('calls ctx.setHelp before adding anything to the scene', () => {
    ctx = initialize(setup, base)
    expect(ctx.setHelp).toHaveBeenCalledTimes(1)
    expect(ctx.setHelp.mock.calls[0][0]).toMatch(/\S/)
    expect(ctx.setHelp.mock.invocationCallOrder[0])
      .toBeLessThan(ctx.add.mock.invocationCallOrder[0])
  })

  it('stages fog and a matching background for a forest interior', () => {
    ctx = initialize(setup, base)
    expect(ctx.scene.fog).toBeInstanceOf(THREE.FogExp2)
    expect(ctx.scene.background).toBeInstanceOf(THREE.Color)
    expect(required(ctx.scene.fog).color.getHex()).toBe((ctx.scene.background instanceof THREE.Color ? ctx.scene.background.getHex() : undefined))
    expect((ctx.scene.fog instanceof THREE.FogExp2 ? ctx.scene.fog.density : undefined)).toBeGreaterThan(0.01)
  })

  it('stages the camera at ground level beneath the canopy, aimed upward', () => {
    ctx = initialize(setup, base)
    const { position } = ctx.camera
    const { canopyBaseY, canopyRadius } = required(ctx._oldGrowth).stats

    expect(position.y).toBeGreaterThan(0.5)
    expect(position.y).toBeLessThan(2.5)

    // The whole canopy hangs overhead, and the camera stands inside its reach.
    expect(canopyBaseY).toBeGreaterThan(position.y + 1.5)
    expect(Math.hypot(position.x, position.z)).toBeLessThan(canopyRadius)

    const look = required(vi.mocked(ctx.camera.lookAt).mock.calls.at(-1))
    const lookY = look[1]
    if (lookY === undefined) throw new Error('Missing camera target')
    expect(lookY - position.y).toBeGreaterThan(1.5)
    expect(ctx.controls.enabled).toBe(false)
  })

  it('builds a tapered branching hierarchy from a few reusable geometries', () => {
    ctx = initialize(setup, base)
    const { stats, limbs } = required(ctx._oldGrowth)

    expect(limbs.length).toBeGreaterThanOrEqual(4)
    expect(stats.branchCount).toBeGreaterThanOrEqual(240)
    expect(stats.tipRadius).toBeLessThan(stats.trunkRadius * 0.25)

    const geometries = new Set(addedObjects(ctx).filter((o): o is THREE.Mesh => o instanceof THREE.Mesh).map(o => o.geometry))
    expect(geometries.size).toBeLessThanOrEqual(12)
  })

  it('flares roots into the floor from one reusable root geometry', () => {
    ctx = initialize(setup, base)
    const roots = instancedByName(ctx, 'old-growth-roots')
    expect(roots).toBeDefined()
    expect(roots.count).toBeGreaterThanOrEqual(12)
    expect(required(ctx._oldGrowth).stats.rootSpread).toBeGreaterThan(1.5)
  })

  it('fills the canopy with dense instanced leaves carried by the limbs', () => {
    ctx = initialize(setup, base)
    const { canopy, stats } = required(ctx._oldGrowth)
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
    ctx = initialize(setup, base)
    const floor = required(addedObjects(ctx).find((o): o is THREE.Mesh<THREE.PlaneGeometry> => o instanceof THREE.Mesh && o.name === 'forest-floor'))
    expect(floor).toBeDefined()
    expect(floor.geometry.parameters.width).toBeGreaterThanOrEqual(80)
    expect(Math.abs(floor.rotation.x + Math.PI / 2)).toBeLessThan(1e-6)
    expect(instancedByName(ctx, 'understory').count).toBeGreaterThanOrEqual(24)
    expect(instancedByName(ctx, 'distant-trunks').count).toBeGreaterThanOrEqual(16)
    expect(required(ctx._oldGrowth).pools.length).toBeGreaterThanOrEqual(3)
    expect(required(ctx._oldGrowth).shafts.length).toBeGreaterThanOrEqual(2)
  })

  it('renders a complete first frame with no progressive reveal', () => {
    ctx = initialize(setup, base)
    for (const obj of addedObjects(ctx)) expect(obj.visible).toBe(true)
    for (const cluster of required(ctx._oldGrowth).canopy) {
      expect(cluster.count).toBe(cluster.instanceMatrix.count)
    }
  })

  it('produces identical geometry for repeated setups', () => {
    ctx = initialize(setup, base)
    const first = canopySignature(ctx)
    const firstStats = { ...required(ctx._oldGrowth).stats }
    teardown(ctx)

    const ctx2 = initialize(setup, makeSpiedContext())
    expect(canopySignature(ctx2)).toBe(first)
    expect(required(ctx2._oldGrowth).stats).toEqual(firstStats)
  })

  it('keeps wind restrained and reuses instance buffers every frame', () => {
    ctx = initialize(setup, base)
    const buffers = required(ctx._oldGrowth).canopy.map(c => c.instanceMatrix.array)

    for (let t = 0; t <= 40; t += 0.5) {
      ctx.elapsed = t
      expect(() => update(ctx, 1 / 60)).not.toThrow()
      for (const limb of required(ctx._oldGrowth).limbs) {
        expect(Math.abs(limb.wind.rotation.z)).toBeLessThan(0.06)
        expect(Math.abs(limb.wind.rotation.x)).toBeLessThan(0.06)
      }
      expect(ctx.camera.position.y).toBeLessThan(2.5)
    }

    required(ctx._oldGrowth).canopy.forEach((c, i) => {
      expect(c.instanceMatrix.array).toBe(buffers[i])
    })
  })

  it('animates the dappled pools over time', () => {
    ctx = initialize(setup, base)
    const before = required(ctx._oldGrowth).pools.map(p => p.material.opacity)
    ctx.elapsed = 7.3
    update(ctx, 1 / 60)
    const after = required(ctx._oldGrowth).pools.map(p => p.material.opacity)
    expect(after).not.toEqual(before)
    for (const opacity of after) {
      expect(opacity).toBeGreaterThan(0)
      expect(opacity).toBeLessThanOrEqual(1)
    }
  })

  it('teardown removes every added object and disposes its resources', () => {
    ctx = initialize(setup, base)
    const addCount = ctx.add.mock.calls.length
    const spies: ReturnType<typeof vi.spyOn>[] = []
    for (const obj of addedObjects(ctx)) {
      if (obj instanceof THREE.Mesh) {
        spies.push(vi.spyOn(obj.geometry, 'dispose'))
        for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) spies.push(vi.spyOn(material, 'dispose'))
      }
    }

    teardown(ctx)

    expect(ctx.remove).toHaveBeenCalledTimes(addCount)
    expect(ctx.scene.children).toHaveLength(0)
    expect(spies.length).toBeGreaterThan(0)
    for (const spy of spies) expect(spy).toHaveBeenCalled()
  })

  it('teardown restores scene and controls state and is idempotent', () => {
    ctx = initialize(setup, base)
    teardown(ctx)
    expect(ctx.scene.fog).toBeNull()
    expect(ctx.scene.background).toBeNull()
    expect(ctx.controls.enabled).toBe(true)
    expect(ctx._oldGrowth).toBeUndefined()
    expect(() => teardown(ctx)).not.toThrow()
    expect(() => update(ctx, 1 / 60)).not.toThrow()
  })
})

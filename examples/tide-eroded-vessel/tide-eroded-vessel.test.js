// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'

function mockManifold() {
  const man = {
    add: vi.fn(() => man),
    subtract: vi.fn(() => man),
    translate: vi.fn(() => man),
    rotate: vi.fn(() => man),
    delete: vi.fn(),
    getMesh: () => ({
      vertProperties: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      triVerts: new Uint32Array([0, 1, 2]),
    }),
  }
  return man
}

vi.mock('manifold-3d', () => ({
  default: vi.fn(async () => ({
    setup: vi.fn(),
    Manifold: {
      cube: vi.fn(() => mockManifold()),
      cylinder: vi.fn(() => mockManifold()),
      sphere: vi.fn(() => mockManifold()),
    },
  })),
}))

vi.mock('three/addons/exporters/STLExporter.js', () => ({
  STLExporter: vi.fn(function STLExporter() {
    this.parse = vi.fn(() => new ArrayBuffer(8))
  }),
}))

vi.mock('three/addons/exporters/OBJExporter.js', () => ({
  OBJExporter: vi.fn(function OBJExporter() {
    this.parse = vi.fn(() => 'o vessel\n')
  }),
}))

function makeMockCtx() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  return {
    Three,
    scene,
    camera: {
      position: new Three.Vector3(0, 40, 120),
      lookAt: vi.fn(),
    },
    renderer: { domElement: canvas, shadowMap: { enabled: false } },
    controls: { target: new Three.Vector3(), update: vi.fn() },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp: vi.fn(),
    elapsed: 0,
  }
}

describe('tide-eroded-vessel', () => {
  let ctx, mod

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./tide-eroded-vessel.js')
  })

  afterEach(() => {
    try { mod.teardown(ctx) } catch (_) { /* ignore */ }
  })

  it('setup() calls setHelp and setBloom', async () => {
    await mod.setup(ctx)
    expect(ctx.setHelp).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() adds a preview mesh and scale grid', async () => {
    await mod.setup(ctx)
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(4)
    const meshes = ctx.scene.children.filter(o => o instanceof Three.Mesh)
    expect(meshes.length).toBeGreaterThanOrEqual(1)
  })

  it('setup() mounts export and reseed controls', async () => {
    await mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    const buttons = [...container.querySelectorAll('button')].map(b => b.textContent)
    expect(buttons.some(t => /STL/i.test(t))).toBe(true)
    expect(buttons.some(t => /OBJ/i.test(t))).toBe(true)
    expect(buttons.some(t => /Reseed/i.test(t))).toBe(true)
  })

  it('update() rotates the vessel without throwing', async () => {
    await mod.setup(ctx)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.5
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('teardown() removes scene objects and UI', async () => {
    await mod.setup(ctx)
    const addCount = ctx.add.mock.calls.length
    mod.teardown(ctx)
    expect(ctx.remove.mock.calls.length).toBe(addCount)
    expect(ctx.renderer.domElement.parentElement.querySelector('button')).toBeNull()
  })
})

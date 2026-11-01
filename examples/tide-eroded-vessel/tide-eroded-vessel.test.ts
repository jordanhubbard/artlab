// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'
import { makeContext } from '../../tests/context.ts'

function mockManifold() {
  class Solid {
    add = vi.fn(() => this)
    subtract = vi.fn(() => this)
    translate = vi.fn(() => this)
    rotate = vi.fn(() => this)
    delete = vi.fn()
    getMesh = () => ({
      vertProperties: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      triVerts: new Uint32Array([0, 1, 2]),
    })
  }
  return new Solid()
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
    return { parse: vi.fn(() => new DataView(new ArrayBuffer(8))) }
  }),
}))

vi.mock('three/addons/exporters/OBJExporter.js', () => ({
  OBJExporter: vi.fn(function OBJExporter() {
    return { parse: vi.fn(() => 'o vessel\n') }
  }),
}))

function makeMockCtx() {
  const ctx = makeContext()
  vi.spyOn(ctx, 'add')
  vi.spyOn(ctx, 'remove')
  vi.spyOn(ctx, 'setBloom')
  vi.spyOn(ctx, 'setHelp')
  return ctx
}

describe('tide-eroded-vessel', () => {
  let ctx: ReturnType<typeof makeMockCtx>
  let mod: typeof import('./tide-eroded-vessel.ts')

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./tide-eroded-vessel.ts')
  })

  afterEach(() => {
    mod.teardown(ctx)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('setup() calls setHelp and setBloom', async () => {
    await mod.setup(ctx)
    expect(ctx.setHelp).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() adds a preview mesh and scale grid', async () => {
    await mod.setup(ctx)
    expect(vi.mocked(ctx.add).mock.calls.length).toBeGreaterThanOrEqual(4)
    const meshes = ctx.scene.children.filter(o => o instanceof Three.Mesh)
    expect(meshes.length).toBeGreaterThanOrEqual(1)
  })

  it('setup() mounts export and reseed controls', async () => {
    await mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    if (!container) throw new Error('Canvas container is missing')
    const buttons = [...container.querySelectorAll('button')].map(b => b.textContent)
    expect(buttons.some(t => /STL/i.test(t ?? ''))).toBe(true)
    expect(buttons.some(t => /OBJ/i.test(t ?? ''))).toBe(true)
    expect(buttons.some(t => /Reseed/i.test(t ?? ''))).toBe(true)
  })

  it('exports the STL DataView as a complete binary download', async () => {
    const create = vi.fn((_blob: Blob) => 'blob:stl-test')
    const revoke = vi.fn()
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = create
      static revokeObjectURL = revoke
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await mod.setup(ctx)
    const buttons = ctx.renderer.domElement.parentElement?.querySelectorAll('button')
    const exportButton = [...buttons ?? []].find(button => /STL/.test(button.textContent ?? ''))
    if (!exportButton) throw new Error('STL export control is missing')
    exportButton.click()
    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0][0].size).toBe(8)
    expect(click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:stl-test')
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
    const addCount = vi.mocked(ctx.add).mock.calls.length
    mod.teardown(ctx)
    expect(vi.mocked(ctx.remove).mock.calls.length).toBe(addCount)
    expect(ctx.renderer.domElement.parentElement?.querySelector('button')).toBeNull()
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// Stub canvas 2D context before the module is imported
const fake2DCtx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  closePath: vi.fn(),
  clearRect: vi.fn(),
}

// Patch HTMLCanvasElement.prototype.getContext so every canvas.getContext('2d')
// returns our fake — including the one created inside canvas-2d.js
const _origGetContext = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function (type, ...args) {
  if (type === '2d') return fake2DCtx
  return _origGetContext.call(this, type, ...args)
}

function makeMockCtx(overrides = {}) {
  const container = document.createElement('div')
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left:0, top:0, width:800, height:600 })
  container.appendChild(canvas)
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new Three.Vector3(0,2,6), lookAt: vi.fn(),
    fov: 60, aspect: 1, updateProjectionMatrix: vi.fn(),
    projectionMatrix: new Three.Matrix4(), matrixWorldInverse: new Three.Matrix4(),
  }
  return {
    Three, scene, camera,
    renderer: { domElement: canvas, shadowMap:{enabled:false}, setSize: vi.fn(), render: vi.fn() },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true, enableDamping: true },
    labelRenderer: { render: vi.fn(), setSize: vi.fn(), domElement: document.createElement('div') },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed: 0,
    sphere: (r=1,s=32) => new Three.SphereGeometry(r,s,s),
    box: (w=1,h=1,d=1) => new Three.BoxGeometry(w,h,d),
    cylinder: (rt=1,rb=1,h=1,s=32) => new Three.CylinderGeometry(rt,rb,h,s),
    torus: (r=1,t=0.4,rs=8,ts=32) => new Three.TorusGeometry(r,t,rs,ts),
    plane: (w=1,h=1) => new Three.PlaneGeometry(w,h),
    cone: (r=1,h=1,s=32) => new Three.ConeGeometry(r,h,s),
    mesh: (geo,opts={}) => new Three.Mesh(geo, new Three.MeshStandardMaterial(opts)),
    ambient: (c=0x404040,i=1) => new Three.AmbientLight(c,i),
    point: (c=0xffffff,i=1,d=0,dc=2) => new Three.PointLight(c,i,d,dc),
    directional: (c=0xffffff,i=1) => new Three.DirectionalLight(c,i),
    ...overrides,
  }
}

describe('canvas-2d', () => {
  let ctx
  let mod

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./canvas-2d.js')
  })

  it('setup() does not throw', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
  })

  it('setup() stores ctx._canvas2d and ctx._ctx2d', () => {
    mod.setup(ctx)
    expect(ctx._canvas2d).toBeDefined()
    expect(ctx._canvas2d).toBeInstanceOf(HTMLCanvasElement)
    expect(ctx._ctx2d).toBe(fake2DCtx)
  })

  it('setup() stores ctx._plane as a Three.Mesh', () => {
    mod.setup(ctx)
    expect(ctx._plane).toBeInstanceOf(Three.Mesh)
  })

  it('setup() stores ctx._texture as a CanvasTexture', () => {
    mod.setup(ctx)
    expect(ctx._texture).toBeInstanceOf(Three.CanvasTexture)
  })

  it('setup() adds the plane via ctx.add', () => {
    mod.setup(ctx)
    expect(ctx.add).toHaveBeenCalledWith(ctx._plane)
  })

  it('update() runs 3 frames without throwing', () => {
    mod.setup(ctx)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('update() calls fake 2D context drawing methods', () => {
    mod.setup(ctx)
    mod.update(ctx, 0.016)
    expect(fake2DCtx.beginPath).toHaveBeenCalled()
    expect(fake2DCtx.arc).toHaveBeenCalled()
    expect(fake2DCtx.stroke).toHaveBeenCalled()
  })

  it('teardown() does not throw', () => {
    mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() calls ctx.remove for plane and point light', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(2)
  })
})

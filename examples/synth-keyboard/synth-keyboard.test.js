// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'
vi.mock('tone', () => ({
  PolySynth: vi.fn(() => ({ connect: vi.fn(), triggerAttackRelease: vi.fn(), dispose: vi.fn() })),
  Synth: vi.fn(),
  Reverb: vi.fn(() => ({ toDestination: vi.fn(), dispose: vi.fn() })),
  start: vi.fn(),
}))

vi.mock('three', async () => await vi.importActual('three'))

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

describe('synth-keyboard', () => {
  let ctx
  let mod

  beforeEach(async () => {
    ctx = makeMockCtx()
    mod = await import('./synth-keyboard.js')
  })

  it('setup() does not throw', async () => {
    await expect(mod.setup(ctx)).resolves.not.toThrow()
  })

  it('setup() calls ctx.add at least once', async () => {
    await mod.setup(ctx)
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() calls ctx.setBloom', async () => {
    await mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates _keyMeshes', async () => {
    await mod.setup(ctx)
    expect(Array.isArray(ctx._keyMeshes)).toBe(true)
    expect(ctx._keyMeshes.length).toBeGreaterThan(0)
  })

  it('setup() creates _lights array', async () => {
    await mod.setup(ctx)
    expect(ctx._lights).toBeDefined()
    expect(ctx._lights.length).toBeGreaterThanOrEqual(2)
  })


  it('update() runs 3 frames without throwing', async () => {
    await mod.setup(ctx)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })



  it('teardown() does not throw', async () => {
    await mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() calls ctx.remove', async () => {
    await mod.setup(ctx)
    mod.teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })


})

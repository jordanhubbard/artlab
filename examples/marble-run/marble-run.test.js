// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'


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

describe('marble-run', () => {
  let ctx
  let mod

  beforeEach(async () => {
    ctx = makeMockCtx()
    mod = await import('./marble-run.js')
  })

  it('setup() does not throw', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
  })

  it('setup() calls ctx.add at least once', () => {
    mod.setup(ctx)
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() calls ctx.setBloom', () => {
    mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates _ramps and _marbles', () => {
    mod.setup(ctx)
    expect(ctx._ramps).toBeDefined()
    expect(ctx._model).toBeInstanceOf(Three.Group)
    expect(Array.isArray(ctx._marbles)).toBe(true)
    expect(ctx._spawnTimer).toBeDefined()
  })

  it('ramps alternate slope direction and are offset to catch the prior exit', () => {
    mod.setup(ctx)
    const tilts = ctx._ramps.map(r => Math.sign(r.tilt))
    expect(tilts).toEqual([-1, 1, -1, 1, -1, 1])
    for (let i = 1; i < ctx._ramps.length; i++) {
      const prior = ctx._ramps[i - 1]
      const next = ctx._ramps[i]
      const priorExit = prior.tilt < 0 ? prior.maxX : prior.minX
      expect(priorExit).toBeGreaterThanOrEqual(next.minX)
      expect(priorExit).toBeLessThanOrEqual(next.maxX)
    }
  })

  it('setup() creates _bowl mesh', () => {
    mod.setup(ctx)
    expect(ctx._bowl).toBeInstanceOf(Three.Mesh)
  })

  it('setup() creates _lights array', () => {
    mod.setup(ctx)
    expect(ctx._lights).toBeDefined()
    expect(ctx._lights.length).toBeGreaterThanOrEqual(2)
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

  it('marbles roll right on ramps that visually descend to the right', () => {
    mod.setup(ctx)
    const ramp = ctx._ramps[0]
    const radius = 0.14
    const x0 = -2.4
    const surfaceY = ramp.cy + (x0 - ramp.cx) * Math.sin(ramp.tilt) + 0.06
    const mesh = new Three.Mesh(new Three.SphereGeometry(radius, 8, 6), new Three.MeshStandardMaterial())
    const marble = {
      pos: new Three.Vector3(x0, surfaceY + radius, 0),
      vel: new Three.Vector3(0, 0, 0),
      radius,
      mesh,
      alive: true,
    }
    ctx._marbles.push(marble)

    for (let i = 0; i < 60; i++) {
      ctx.elapsed += 0.016
      mod.update(ctx, 0.016)
    }

    expect(marble.pos.x).toBeGreaterThan(x0)
  })

  it('default seeded marbles traverse the full ramp stack into the catch basin', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    try {
      mod.setup(ctx)
      ctx._spawnTimer = 10
      mod.update(ctx, 0.016)
      expect(ctx._marbles).toHaveLength(1)
      const marble = ctx._marbles[0]

      for (let i = 0; i < 2300; i++) {
        ctx.elapsed += 0.016
        mod.update(ctx, 0.016)
      }

      const bottomRamp = ctx._ramps[ctx._ramps.length - 1]
      expect(marble.alive).toBe(true)
      expect(marble.pos.y).toBeLessThan(bottomRamp.cy)
      expect(marble.pos.y).toBeGreaterThan(bottomRamp.cy - 1.5)
      expect(marble.pos.x).toBeGreaterThan(-5.4)
      expect(marble.pos.x).toBeLessThan(0.6)
    } finally {
      randomSpy.mockRestore()
    }
  })

  it('arrow keys tilt the model and R resets it', () => {
    mod.setup(ctx)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(ctx._model.rotation.z).toBeLessThan(0)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(ctx._model.rotation.x).toBeGreaterThan(0)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }))
    expect(ctx._model.rotation.x).toBe(0)
    expect(ctx._model.rotation.z).toBe(0)
  })


  it('teardown() does not throw', () => {
    mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() calls ctx.remove', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })


})

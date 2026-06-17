// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx(overrides = {}) {
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = { position: new Three.Vector3(0,0,0), lookAt: vi.fn(), quaternion: new Three.Quaternion() }
  const controls = { update: vi.fn(), target: new Three.Vector3(), enabled: true }
  const container = document.createElement('div')
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left:0, top:0, width:800, height:600 })
  container.appendChild(canvas)
  const renderer = {
    domElement: canvas,
    shadowMap: { enabled: false }, setSize: vi.fn(), render: vi.fn(),
  }
  return {
    Three, scene, camera, controls, renderer,
    labelRenderer: { render: vi.fn(), setSize: vi.fn(), domElement: document.createElement('div') },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed: 0,
    sphere: (r=1,s=32) => new Three.SphereGeometry(r,s,s),
    box: (w=1,h=1,d=1) => new Three.BoxGeometry(w,h,d),
    torus: (r=1,t=0.4,rs=8,ts=32) => new Three.TorusGeometry(r,t,rs,ts),
    mesh: (geo, opts={}) => new Three.Mesh(geo, new Three.MeshStandardMaterial(opts)),
    ambient: (c=0x404040,i=1) => new Three.AmbientLight(c,i),
    point: (c=0xffffff,i=1,d=0,dc=2) => new Three.PointLight(c,i,d,dc),
    ...overrides,
  }
}

describe('camera-journey', () => {
  let ctx
  let setup, update, teardown

  beforeEach(async () => {
    document.body.innerHTML = ''
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./camera-journey.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() creates _rings and _orbiters arrays', () => {
    setup(ctx)
    expect(ctx._cameraPath).toBeDefined()
    expect(ctx._pillarField).toBeInstanceOf(Three.InstancedMesh)
    expect(Array.isArray(ctx._rings)).toBe(true)
    expect(ctx._rings.length).toBeGreaterThanOrEqual(3)
    expect(Array.isArray(ctx._orbiters)).toBe(true)
    expect(ctx._orbiters.length).toBeGreaterThanOrEqual(6)
  })

  it('scripted update moves the camera along the path', () => {
    setup(ctx)
    const start = ctx.camera.position.clone()
    ctx.elapsed = 3
    update(ctx, 0.016)
    expect(ctx.camera.position.distanceTo(start)).toBeGreaterThan(0.1)
    expect(ctx.camera.lookAt).toHaveBeenCalled()
  })

  it('C toggles manual controls and Space rejoins the scripted path', () => {
    setup(ctx)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }))
    expect(ctx._useOrbit).toBe(true)
    expect(ctx.controls.enabled).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(ctx._useOrbit).toBe(false)
    expect(ctx.controls.enabled).toBe(false)
  })

  it('update() runs 3 frames without throwing', () => {
    setup(ctx)
    const frames = [0, 0.016, 0.032]
    for (const elapsed of frames) {
      ctx.elapsed = elapsed
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() runs without throwing and re-enables controls', () => {
    setup(ctx)
    expect(() => teardown(ctx)).not.toThrow()
    expect(ctx.controls.enabled).toBe(true)
    expect(ctx.renderer.domElement.parentElement.querySelector('#camera-journey-hud')).toBeNull()
  })
})

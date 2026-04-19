// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx(overrides = {}) {
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = { position: new THREE.Vector3(0,0,0), lookAt: vi.fn(), quaternion: new THREE.Quaternion() }
  const controls = { update: vi.fn(), target: new THREE.Vector3(), enabled: true }
  const renderer = {
    domElement: Object.assign(document.createElement('canvas'), {
      getBoundingClientRect: () => ({ left:0, top:0, width:800, height:600 })
    }),
    shadowMap: { enabled: false }, setSize: vi.fn(), render: vi.fn(),
  }
  return {
    THREE, scene, camera, controls, renderer,
    labelRenderer: { render: vi.fn(), setSize: vi.fn(), domElement: document.createElement('div') },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    sphere: (r=1,s=32) => new THREE.SphereGeometry(r,s,s),
    box: (w=1,h=1,d=1) => new THREE.BoxGeometry(w,h,d),
    torus: (r=1,t=0.4,rs=8,ts=32) => new THREE.TorusGeometry(r,t,rs,ts),
    mesh: (geo, opts={}) => new THREE.Mesh(geo, new THREE.MeshStandardMaterial(opts)),
    ambient: (c=0x404040,i=1) => new THREE.AmbientLight(c,i),
    point: (c=0xffffff,i=1,d=0,dc=2) => new THREE.PointLight(c,i,d,dc),
    ...overrides,
  }
}

describe('camera-journey', () => {
  let ctx
  let setup, update, teardown

  beforeEach(async () => {
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./camera-journey.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() creates _rings and _orbiters arrays', () => {
    setup(ctx)
    expect(Array.isArray(ctx._rings)).toBe(true)
    expect(ctx._rings.length).toBeGreaterThanOrEqual(3)
    expect(Array.isArray(ctx._orbiters)).toBe(true)
    expect(ctx._orbiters.length).toBeGreaterThanOrEqual(6)
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
  })
})

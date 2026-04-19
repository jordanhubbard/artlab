// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx(overrides = {}) {
  const container = document.createElement('div')
  // Attach container to the document body so getBoundingClientRect works
  document.body.appendChild(container)
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left:0, top:0, width:800, height:600 })
  container.appendChild(canvas)
  // ui-showcase uses ctx.renderer.domElement.parentElement as the container
  // Make sure parentElement is the div we created above
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new THREE.Vector3(0,2,6), lookAt: vi.fn(),
    fov: 60, aspect: 1, updateProjectionMatrix: vi.fn(),
    projectionMatrix: new THREE.Matrix4(), matrixWorldInverse: new THREE.Matrix4(),
  }
  return {
    THREE, scene, camera,
    renderer: { domElement: canvas, shadowMap:{enabled:false}, setSize: vi.fn(), render: vi.fn() },
    controls: { update: vi.fn(), target: new THREE.Vector3(), enabled: true, enableDamping: true },
    labelRenderer: { render: vi.fn(), setSize: vi.fn(), domElement: document.createElement('div') },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    sphere: (r=1,s=32) => new THREE.SphereGeometry(r,s,s),
    box: (w=1,h=1,d=1) => new THREE.BoxGeometry(w,h,d),
    cylinder: (rt=1,rb=1,h=1,s=32) => new THREE.CylinderGeometry(rt,rb,h,s),
    torus: (r=1,t=0.4,rs=8,ts=32) => new THREE.TorusGeometry(r,t,rs,ts),
    plane: (w=1,h=1) => new THREE.PlaneGeometry(w,h),
    cone: (r=1,h=1,s=32) => new THREE.ConeGeometry(r,h,s),
    mesh: (geo,opts={}) => new THREE.Mesh(geo, new THREE.MeshStandardMaterial(opts)),
    ambient: (c=0x404040,i=1) => new THREE.AmbientLight(c,i),
    point: (c=0xffffff,i=1,d=0,dc=2) => new THREE.PointLight(c,i,d,dc),
    directional: (c=0xffffff,i=1) => new THREE.DirectionalLight(c,i),
    ...overrides,
  }
}

describe('ui-showcase', () => {
  let ctx
  let mod

  beforeEach(async () => {
    // Clean up DOM between tests
    document.body.innerHTML = ''
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./ui-showcase.js')
  })

  it('setup() does not throw', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
  })

  it('setup() adds meshes via ctx.add', () => {
    mod.setup(ctx)
    // Lights (3) + 6 meshes = at least 7 adds
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(7)
  })

  it('setup() appends a control panel to the container', () => {
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    // The panel has a known id-less div but contains '#ui-stats'
    const statsEl = container.querySelector('#ui-stats')
    expect(statsEl).not.toBeNull()
  })

  it('setup() appends a tooltip element to the container', () => {
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    // Tooltip is a div with pointerEvents:none
    const divs = container.querySelectorAll('div')
    expect(divs.length).toBeGreaterThan(1)
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

  it('update() updates the stat panel content', () => {
    mod.setup(ctx)
    ctx.elapsed = 1.5
    mod.update(ctx, 0.016)
    const container = ctx.renderer.domElement.parentElement
    const statsEl = container.querySelector('#ui-stats')
    expect(statsEl.innerHTML).toContain('elapsed')
    expect(statsEl.innerHTML).toContain('objects')
  })

  it('teardown() does not throw', () => {
    mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown() removes the panel from the DOM', () => {
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    expect(container.querySelector('#ui-stats')).not.toBeNull()
    mod.teardown(ctx)
    // panel.remove() is called, so #ui-stats should be gone
    expect(container.querySelector('#ui-stats')).toBeNull()
  })

  it('teardown() calls ctx.remove for all meshes', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    // 6 OBJECTS → 6 removes
    expect(ctx.remove.mock.calls.length).toBeGreaterThanOrEqual(6)
  })
})

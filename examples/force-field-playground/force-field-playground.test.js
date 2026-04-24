// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

vi.mock('../../src/stdlib/physics/particles.js', () => ({
  createParticleWorld: () => ({
    addBody:      vi.fn(),
    removeBody:   vi.fn(),
    getParticles: vi.fn(() => []),
    step:         vi.fn(),
  }),
  emitter: (world, scene) => {
    const geometry = { setAttribute: vi.fn(), setDrawRange: vi.fn() }
    const material = { vertexColors: false, needsUpdate: false }
    const points   = { geometry, material }
    scene.add(points)
    return {
      emitterId: 'emitter_0',
      points,
      update:  vi.fn(),
      dispose: vi.fn(() => scene.remove(points)),
    }
  },
  forceField: vi.fn(),
}))

vi.mock('../../src/stdlib/ui.js', () => ({
  label: vi.fn(() => ({
    label:      {},
    setText:    vi.fn(),
    setOpacity: vi.fn(),
    detach:     vi.fn(),
  })),
  hud: vi.fn(() => ({
    el:      document.createElement('div'),
    setText: vi.fn(),
    setHTML: vi.fn(),
    show:    vi.fn(),
    hide:    vi.fn(),
    dispose: vi.fn(),
  })),
}))

function makeMockCtx(overrides = {}) {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position:               new Three.Vector3(0, 20, 25),
    lookAt:                 vi.fn(),
    fov:                    60,
    aspect:                 800 / 600,
    near:                   0.1,
    far:                    1000,
    updateProjectionMatrix: vi.fn(),
    projectionMatrix:       new Three.Matrix4(),
    matrixWorldInverse:     new Three.Matrix4(),
  }
  return {
    Three, scene, camera,
    renderer: {
      domElement: canvas,
      shadowMap:  { enabled: false },
      setSize:    vi.fn(),
      render:     vi.fn(),
    },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true },
    add:      vi.fn(obj => { scene.children.push(obj); return obj }),
    remove:   vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed:  0,
    ...overrides,
  }
}

describe('force-field-playground', () => {
  let ctx, mod

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./force-field-playground.js')
  })

  it('setup runs without throwing', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
  })

  it('setup calls ctx.setBloom', () => {
    mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalledWith(1.4)
  })

  it('setup adds lights and ground plane via ctx.add', () => {
    mod.setup(ctx)
    // ambientLight + ptLight + groundPlane = 3
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('update runs without throwing', () => {
    mod.setup(ctx)
    expect(() => mod.update(ctx, 0.016)).not.toThrow()
  })

  it('update runs 3 frames without throwing', () => {
    mod.setup(ctx)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('click event does not throw', () => {
    mod.setup(ctx)
    expect(() => {
      window.dispatchEvent(new MouseEvent('click', { clientX: 400, clientY: 300, bubbles: true }))
    }).not.toThrow()
  })

  it('teardown does not throw', () => {
    mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })

  it('teardown removes all objects added via ctx.add', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    // groundPlane + ambientLight + ptLight = 3 removes minimum
    expect(ctx.remove.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('teardown removes the event listener (second teardown does not throw)', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    // Re-setup then teardown again should not throw
    mod.setup(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })
})

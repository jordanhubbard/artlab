// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

vi.mock('../../src/stdlib/audio.js', () => ({
  start:  vi.fn().mockResolvedValue(undefined),
  stop:   vi.fn().mockResolvedValue(undefined),
  update: vi.fn(() => ({ bass: 0.5, mid: 0.3, high: 0.2, raw: null })),
  band:   vi.fn(() => 0.3),
}))

vi.mock('../../src/stdlib/physics/particles.js', () => ({
  createParticleWorld: () => ({
    addBody:      vi.fn(),
    removeBody:   vi.fn(),
    getParticles: vi.fn(() => []),
    step:         vi.fn(),
  }),
  emitter: (world, scene) => {
    const geometry = { setAttribute: vi.fn(), setDrawRange: vi.fn() }
    const material = {}
    const points   = { geometry, material, position: { x: 0, y: 0, z: 0 } }
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

function makeMockCtx(overrides = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  container.appendChild(canvas)

  const scene  = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new Three.Vector3(0, 2, 6),
    lookAt:   vi.fn(),
    fov: 60, aspect: 1,
    updateProjectionMatrix: vi.fn(),
    projectionMatrix:   new Three.Matrix4(),
    matrixWorldInverse: new Three.Matrix4(),
  }
  return {
    Three, scene, camera,
    renderer: { domElement: canvas, shadowMap: { enabled: false }, setSize: vi.fn(), render: vi.fn() },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true },
    add:      vi.fn(obj => { scene.children.push(obj); return obj }),
    remove:   vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed:  0,
    ...overrides,
  }
}

describe('audio-terrain', () => {
  let ctx, mod

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./audio-terrain.js')
  })

  afterEach(async () => {
    try { await mod.teardown(ctx) } catch (_) {}
  })

  it('setup() does not throw', async () => {
    await expect(mod.setup(ctx)).resolves.not.toThrow()
  })

  it('setup() calls ctx.setBloom', async () => {
    await mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.9)
  })

  it('setup() adds terrain + 2 lights via ctx.add', async () => {
    await mod.setup(ctx)
    // AmbientLight + HemisphereLight + terrain mesh = 3 minimum
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('setup() adds an "Enable Microphone" button to the container', async () => {
    await mod.setup(ctx)
    const btn = ctx.renderer.domElement.parentElement.querySelector('button')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('Microphone')
  })

  it('update() runs multiple frames without throwing', async () => {
    await mod.setup(ctx)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('update() moves camera each frame (orbit)', async () => {
    await mod.setup(ctx)
    ctx.elapsed = 1.0
    mod.update(ctx, 0.016)
    // Camera X should be cos(0.09) * 28
    expect(ctx.camera.position.x).toBeCloseTo(Math.cos(0.09) * 28, 3)
  })

  it('clicking mic button calls audio start()', async () => {
    const audioMod = await import('../../src/stdlib/audio.js')
    await mod.setup(ctx)
    const btn = ctx.renderer.domElement.parentElement.querySelector('button')
    btn.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(audioMod.start).toHaveBeenCalled()
  })

  it('teardown() does not throw', async () => {
    await mod.setup(ctx)
    await expect(mod.teardown(ctx)).resolves.not.toThrow()
  })

  it('teardown() removes terrain + lights via ctx.remove', async () => {
    await mod.setup(ctx)
    await mod.teardown(ctx)
    // terrain + ambLight + hemiLight = 3 minimum
    expect(ctx.remove.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('teardown() removes the mic button from DOM', async () => {
    await mod.setup(ctx)
    expect(ctx.renderer.domElement.parentElement.querySelector('button')).not.toBeNull()
    await mod.teardown(ctx)
    expect(ctx.renderer.domElement.parentElement.querySelector('button')).toBeNull()
  })

  it('teardown() calls audio stop() when mic was enabled', async () => {
    const audioMod = await import('../../src/stdlib/audio.js')
    await mod.setup(ctx)
    // Simulate mic button click to set _audioOn = true
    const btn = ctx.renderer.domElement.parentElement.querySelector('button')
    btn.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    await mod.teardown(ctx)
    expect(audioMod.stop).toHaveBeenCalled()
  })

  it('teardown() followed by setup() does not throw (state reset)', async () => {
    await mod.setup(ctx)
    await mod.teardown(ctx)
    const ctx2 = makeMockCtx()
    await expect(mod.setup(ctx2)).resolves.not.toThrow()
    await mod.teardown(ctx2)
  })
})

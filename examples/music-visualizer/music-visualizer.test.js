// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

vi.mock('../../src/stdlib/audio.js', () => ({
  start:  vi.fn().mockResolvedValue(undefined),
  stop:   vi.fn().mockResolvedValue(undefined),
  update: vi.fn(() => ({ bass: 0.5, mid: 0.3, high: 0.2, raw: null })),
  band:   vi.fn((name) => {
    if (name === 'bass') return 0.5
    if (name === 'mid')  return 0.3
    return 0.2
  }),
}))

function makeMockCtx(overrides = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  container.appendChild(canvas)

  const scene  = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new Three.Vector3(0, 2, 18),
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
    elapsed:  0,
    ...overrides,
  }
}

describe('music-visualizer', () => {
  let ctx, mod

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./music-visualizer.js')
  })

  afterEach(async () => {
    try { await mod.teardown(ctx) } catch (_) {}
  })

  // ── setup() ──────────────────────────────────────────────────────────────

  it('setup() does not throw', async () => {
    await expect(mod.setup(ctx)).resolves.not.toThrow()
  })

  it('setup() calls ctx.setBloom for initial glow', async () => {
    await mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.8)
  })

  it('setup() adds 3 rings + star-field + 2 lights via ctx.add (≥6 calls)', async () => {
    await mod.setup(ctx)
    // AmbientLight + PointLight + 3 ring meshes + star-field Points = 6
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(6)
  })

  it('setup() creates ring meshes with TorusGeometry', async () => {
    await mod.setup(ctx)
    const torusMeshes = ctx.scene.children.filter(
      obj => obj.geometry && obj.geometry.type === 'TorusGeometry'
    )
    expect(torusMeshes.length).toBe(3)
  })

  it('setup() creates a star-field Points object', async () => {
    await mod.setup(ctx)
    const points = ctx.scene.children.filter(obj => obj.isPoints)
    expect(points.length).toBe(1)
  })

  it('setup() adds an "Enable Microphone" button to the container', async () => {
    await mod.setup(ctx)
    const btn = ctx.renderer.domElement.parentElement.querySelector('button')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('Microphone')
  })

  // ── update() ─────────────────────────────────────────────────────────────

  it('update() runs multiple frames (idle path) without throwing', async () => {
    await mod.setup(ctx)
    expect(() => {
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.016
      mod.update(ctx, 0.016)
      ctx.elapsed = 0.032
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('update() calls setBloom each frame', async () => {
    await mod.setup(ctx)
    ctx.setBloom.mockClear()
    mod.update(ctx, 0.016)
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('update() moves camera on orbit path', async () => {
    await mod.setup(ctx)
    const origX = ctx.camera.position.x
    ctx.elapsed = 2.0
    mod.update(ctx, 0.016)
    // Camera should have orbited to a new X position
    expect(ctx.camera.position.x).not.toBeCloseTo(origX, 2)
  })

  it('update() calls camera.lookAt(0,0,0)', async () => {
    await mod.setup(ctx)
    ctx.camera.lookAt.mockClear()
    mod.update(ctx, 0.016)
    expect(ctx.camera.lookAt).toHaveBeenCalledWith(0, 0, 0)
  })

  it('update() modifies ring vertex positions (waveform displacement)', async () => {
    await mod.setup(ctx)
    // Grab bass ring mesh
    const bassRing = ctx.scene.children.find(
      obj => obj.geometry?.type === 'TorusGeometry' && obj.geometry.parameters.radius === 7
    )
    expect(bassRing).toBeDefined()

    // Snapshot first vertex before update
    const posArr = bassRing.geometry.attributes.position.array
    const v0Before = posArr[0]

    ctx.elapsed = 1.0
    mod.update(ctx, 0.5) // large dt to ensure smoothed value moves

    // Vertex should have been displaced
    const v0After = posArr[0]
    expect(v0After).not.toBeCloseTo(v0Before, 4)
  })

  it('update() scales ring meshes based on band energy', async () => {
    await mod.setup(ctx)
    // Run several frames to let smoothed values build up
    for (let i = 0; i < 20; i++) {
      ctx.elapsed = i * 0.05
      mod.update(ctx, 0.05)
    }
    const bassRing = ctx.scene.children.find(
      obj => obj.geometry?.type === 'TorusGeometry' && obj.geometry.parameters.radius === 7
    )
    // Scale should be > 1 since bass > 0 in procedural fallback
    expect(bassRing.scale.x).toBeGreaterThan(1)
  })

  // ── Audio button ─────────────────────────────────────────────────────────

  it('clicking mic button calls audio start()', async () => {
    const audioMod = await import('../../src/stdlib/audio.js')
    await mod.setup(ctx)
    const btn = ctx.renderer.domElement.parentElement.querySelector('button')
    btn.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(audioMod.start).toHaveBeenCalled()
  })

  it('clicking mic button hides the button', async () => {
    await mod.setup(ctx)
    const btn = ctx.renderer.domElement.parentElement.querySelector('button')
    btn.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(btn.style.display).toBe('none')
  })

  // ── teardown() ───────────────────────────────────────────────────────────

  it('teardown() does not throw', async () => {
    await mod.setup(ctx)
    await expect(mod.teardown(ctx)).resolves.not.toThrow()
  })

  it('teardown() removes rings, stars, and lights via ctx.remove (≥6)', async () => {
    await mod.setup(ctx)
    await mod.teardown(ctx)
    // 3 rings + 1 star-field + 2 lights = 6 minimum
    expect(ctx.remove.mock.calls.length).toBeGreaterThanOrEqual(6)
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
    // Simulate mic button click
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

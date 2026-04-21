// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
  now: vi.fn(() => 0),
  Transport: {
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    state: 'stopped',
    bpm: { value: 120 },
  },
  Synth: vi.fn(() => ({
    connect: vi.fn().mockReturnThis(),
    toDestination: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    triggerAttackRelease: vi.fn(),
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    releaseAll: vi.fn(),
  })),
  PolySynth: vi.fn(() => ({
    connect: vi.fn().mockReturnThis(),
    toDestination: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    triggerAttackRelease: vi.fn(),
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    releaseAll: vi.fn(),
  })),
  Reverb: vi.fn(() => ({
    connect: vi.fn().mockReturnThis(),
    toDestination: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    generate: vi.fn().mockResolvedValue(undefined),
  })),
}))

// ── Mock ctx ─────────────────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  container.appendChild(canvas)

  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new Three.Vector3(0, 8, 12),
    lookAt: vi.fn(),
    fov: 60,
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
    projectionMatrix: new Three.Matrix4(),
    matrixWorldInverse: new Three.Matrix4(),
  }

  return {
    Three,
    scene,
    camera,
    renderer: {
      domElement: canvas,
      shadowMap: { enabled: false },
      setSize: vi.fn(),
      render: vi.fn(),
    },
    controls: {
      update: vi.fn(),
      target: new Three.Vector3(),
      enabled: true,
      enableDamping: true,
    },
    labelRenderer: {
      render: vi.fn(),
      setSize: vi.fn(),
      domElement: document.createElement('div'),
    },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('synth-keyboard', () => {
  let ctx
  let mod

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    ctx = makeCtx()
    mod = await import('./synth-keyboard.js')
  })

  afterEach(async () => {
    try { await mod.teardown(ctx) } catch (_) {}
  })

  it('exports setup, update, teardown', () => {
    expect(typeof mod.setup).toBe('function')
    expect(typeof mod.update).toBe('function')
    expect(typeof mod.teardown).toBe('function')
  })

  it('setup() does not throw', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
  })

  it('setup() calls ctx.setBloom', () => {
    mod.setup(ctx)
    expect(ctx.setBloom).toHaveBeenCalledWith(0.8)
  })

  it('setup() adds key meshes, lights, and particle system', () => {
    mod.setup(ctx)
    // 2 lights + 15 white keys + 10 black keys + 1 InstancedMesh = 28 minimum
    expect(ctx.add.mock.calls.length).toBeGreaterThanOrEqual(25)
  })

  it('setup() creates a "Start Synth" button in the container', () => {
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    const btn = container.querySelector('button')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('Start Synth')
  })

  it('setup() adds an InstancedMesh for particles', () => {
    mod.setup(ctx)
    const instancedCalls = ctx.add.mock.calls.filter(
      ([obj]) => obj instanceof Three.InstancedMesh
    )
    expect(instancedCalls.length).toBe(1)
  })

  it('setup() adds white and black key meshes', () => {
    mod.setup(ctx)
    const meshCalls = ctx.add.mock.calls.filter(
      ([obj]) => obj instanceof Three.Mesh && !(obj instanceof Three.InstancedMesh)
    )
    // 15 white + 10 black = 25 key meshes (lights are not Mesh in standard Three)
    // Actually AmbientLight/DirectionalLight extend Object3D, not Mesh
    expect(meshCalls.length).toBeGreaterThanOrEqual(25)
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

  it('update() handles large dt gracefully (tab switch)', () => {
    mod.setup(ctx)
    expect(() => {
      mod.update(ctx, 5.0) // 5 second gap
    }).not.toThrow()
  })

  it('clicking Start Synth button calls Tone.start and creates PolySynth', async () => {
    const Tone = await import('tone')
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    const btn = container.querySelector('button')
    btn.click()
    // Flush promises
    await new Promise(r => setTimeout(r, 10))
    expect(Tone.start).toHaveBeenCalled()
    expect(Tone.PolySynth).toHaveBeenCalled()
    expect(Tone.Reverb).toHaveBeenCalled()
  })

  it('start button hides after click', async () => {
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    const btn = container.querySelector('button')
    btn.click()
    await new Promise(r => setTimeout(r, 10))
    expect(btn.style.display).toBe('none')
  })

  it('teardown() does not throw', async () => {
    mod.setup(ctx)
    await expect(Promise.resolve(mod.teardown(ctx))).resolves.not.toThrow()
  })

  it('teardown() removes the start button from DOM', async () => {
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    expect(container.querySelector('button')).not.toBeNull()
    mod.teardown(ctx)
    expect(container.querySelector('button')).toBeNull()
  })

  it('teardown() after start disposes synth and reverb', async () => {
    const Tone = await import('tone')
    mod.setup(ctx)
    const container = ctx.renderer.domElement.parentElement
    const btn = container.querySelector('button')
    btn.click()
    await new Promise(r => setTimeout(r, 10))

    // Capture the synth and reverb instances before teardown
    const synthInstance = Tone.PolySynth.mock.results[0]?.value
    const reverbInstance = Tone.Reverb.mock.results[0]?.value

    mod.teardown(ctx)

    if (synthInstance) expect(synthInstance.dispose).toHaveBeenCalled()
    if (reverbInstance) expect(reverbInstance.dispose).toHaveBeenCalled()
  })

  it('keyboard events do not throw when audio not started', () => {
    mod.setup(ctx)
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }))
    }).not.toThrow()
  })

  it('camera is positioned to view the keyboard', () => {
    mod.setup(ctx)
    expect(ctx.camera.position.y).toBeGreaterThan(0)
    expect(ctx.camera.lookAt).toHaveBeenCalled()
  })
})

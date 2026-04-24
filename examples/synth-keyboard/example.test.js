// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))
vi.mock('tone', () => ({
  PolySynth: vi.fn(() => ({
    triggerAttack: vi.fn(), triggerRelease: vi.fn(), connect: vi.fn(), dispose: vi.fn(),
  })),
  Synth: vi.fn(),
  Reverb: vi.fn(() => ({
    toDestination: vi.fn(), dispose: vi.fn(),
  })),
  start: vi.fn(),
}))

function makeMockCtx() {
  const scene = { add: vi.fn(), remove: vi.fn(), children: [], fog: null }
  return {
    Three, scene,
    camera: { position: new Three.Vector3(0, 0, 50), lookAt: vi.fn(), aspect: 1, fov: 60, updateProjectionMatrix: vi.fn() },
    renderer: { domElement: document.createElement('canvas'), shadowMap: { enabled: false }, setSize: vi.fn() },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed: 0,
  }
}

describe('synth-keyboard', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./synth-keyboard.js'))
  })

  it('setup() completes without throwing', async () => {
    await expect(setup(ctx)).resolves.not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('creates key meshes and particle system', async () => {
    await setup(ctx)
    expect(ctx._keyMeshes.length).toBeGreaterThan(8) // 8 white + black keys
    expect(ctx._particleSystem).toBeInstanceOf(Three.Points)
  })

  it('update() runs multiple frames', async () => {
    await setup(ctx)
    for (const t of [0, 0.016, 0.5, 1.0]) {
      ctx.elapsed = t
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() removes all objects and disposes Tone nodes', async () => {
    await setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._particleSystem)
    expect(ctx._synth.dispose).toHaveBeenCalled()
    expect(ctx._reverb.dispose).toHaveBeenCalled()
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function setupMediaMocks() {
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockRejectedValue(new Error('no mic')) },
    configurable: true, writable: true,
  })
  globalThis.AudioContext = undefined
  globalThis.webkitAudioContext = undefined
}

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

describe('music-visualizer', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    setupMediaMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./music-visualizer.js'))
  })

  it('setup() completes without throwing', async () => {
    await expect(setup(ctx)).resolves.not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('creates 3 ring meshes and particle system', async () => {
    await setup(ctx)
    expect(ctx._rings).toHaveLength(3)
    expect(ctx._particles).toBeInstanceOf(Three.Points)
  })

  it('update() runs multiple frames with sine fallback', async () => {
    await setup(ctx)
    for (const t of [0, 0.016, 0.5, 1.0, 2.0]) {
      ctx.elapsed = t
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('rings scale changes during update', async () => {
    await setup(ctx)
    ctx.elapsed = 0
    update(ctx, 0.016)
    const s1 = ctx._rings[0].mesh.scale.x
    ctx.elapsed = 0.5
    update(ctx, 0.016)
    const s2 = ctx._rings[0].mesh.scale.x
    expect(s1).not.toBe(s2)
  })

  it('teardown() removes all objects', async () => {
    await setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._particles)
  })
})

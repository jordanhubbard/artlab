// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// Mock getUserMedia to return a fake stream
function setupMediaMocks() {
  const fakeTrack = { stop: vi.fn() }
  const fakeStream = { getTracks: () => [fakeTrack] }
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockRejectedValue(new Error('no mic in test')) },
    configurable: true,
    writable: true,
  })
  // Also mock AudioContext so fallback path is exercised cleanly
  globalThis.AudioContext = undefined
  globalThis.webkitAudioContext = undefined
  return fakeStream
}

function makeMockCtx(overrides = {}) {
  const scene = { add: vi.fn(), remove: vi.fn(), children: [], fog: null }
  const camera = {
    position: new Three.Vector3(0, 0, 50),
    lookAt: vi.fn(), aspect: 1, fov: 60,
    updateProjectionMatrix: vi.fn(),
  }
  return {
    Three, scene, camera,
    renderer: { domElement: document.createElement('canvas'), shadowMap: { enabled: false }, setSize: vi.fn() },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('audio-terrain', () => {
  let ctx, setup, update, teardown

  beforeEach(async () => {
    vi.clearAllMocks()
    setupMediaMocks()
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./audio-terrain.js'))
  })

  it('setup() completes without throwing (no mic fallback)', async () => {
    await expect(setup(ctx)).resolves.not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() creates terrain mesh with color attribute', async () => {
    await setup(ctx)
    expect(ctx._terrain).toBeInstanceOf(Three.Mesh)
    expect(ctx._terrain.geometry.attributes.color).toBeDefined()
    expect(ctx._analyser).toBeNull()  // no mic → null
  })

  it('update() uses sine fallback and runs without throwing', async () => {
    await setup(ctx)
    const frames = [0, 0.016, 0.5, 1.0]
    for (const elapsed of frames) {
      ctx.elapsed = elapsed
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() removes terrain and lights', async () => {
    await setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledWith(ctx._terrain)
  })
})

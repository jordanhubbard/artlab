// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'

const mockTrack = { stop: vi.fn() }
const mockStream = { getTracks: () => [mockTrack] }

vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue(mockStream),
  },
})

Object.defineProperty(window.HTMLVideoElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})

const _origAddEL = HTMLButtonElement.prototype.addEventListener
HTMLButtonElement.prototype.addEventListener = function (type, cb, opts) {
  _origAddEL.call(this, type, cb, opts)
  if (type === 'click') cb(new MouseEvent('click'))
}

function makeMockCtx() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  return {
    Three,
    scene,
    camera: {
      position: new Three.Vector3(0, 0, 8),
      lookAt: vi.fn(),
    },
    renderer: { domElement: canvas, shadowMap: { enabled: false } },
    controls: { target: new Three.Vector3(), update: vi.fn() },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp: vi.fn(),
    elapsed: 0,
  }
}

describe('motion-scale-lantern', () => {
  let ctx, mod

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream)
    ctx = makeMockCtx()
    mod = await import('./motion-scale-lantern.js')
  })

  afterEach(() => {
    try { mod.teardown(ctx) } catch (_) { /* ignore */ }
  })

  it('setup() calls setHelp and setBloom', async () => {
    await mod.setup(ctx)
    expect(ctx.setHelp).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() adds an inner shell and outward scales', async () => {
    await mod.setup(ctx)
    const meshes = ctx.scene.children.filter(o => o instanceof Three.Mesh)
    expect(meshes.length).toBeGreaterThan(20)
  })

  it('update() flares scales without throwing', async () => {
    await mod.setup(ctx)
    expect(() => {
      ctx.elapsed = 0.2
      mod.update(ctx, 0.016)
      ctx.elapsed = 1.0
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('teardown() removes meshes and stops the webcam', async () => {
    await mod.setup(ctx)
    await Promise.resolve()
    const addCount = ctx.add.mock.calls.length
    mod.teardown(ctx)
    expect(ctx.remove.mock.calls.length).toBe(addCount)
    expect(mockTrack.stop).toHaveBeenCalled()
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'
import { makeContext } from '../../tests/context.ts'

const mockTrack = { stop: vi.fn() }
const mockStream = { getTracks: () => [mockTrack] } as unknown as MediaStream

vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue(mockStream),
  },
})

Object.defineProperty(window.HTMLVideoElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})

function makeMockCtx() {
  const ctx = makeContext()
  vi.spyOn(ctx, 'add')
  vi.spyOn(ctx, 'remove')
  vi.spyOn(ctx, 'setBloom')
  vi.spyOn(ctx, 'setHelp')
  return ctx
}

describe('motion-scale-lantern', () => {
  let ctx: ReturnType<typeof makeMockCtx>
  let mod: typeof import('./motion-scale-lantern.ts')

  async function setupScene() {
    const ready = mod.setup(ctx)
    const button = ctx.renderer.domElement.parentElement?.querySelector('button')
    if (!button) throw new Error('Camera gesture button is missing')
    button.click()
    await ready
  }

  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(mockStream)
    ctx = makeMockCtx()
    mod = await import('./motion-scale-lantern.ts')
  })

  afterEach(() => {
    mod.teardown(ctx)
  })

  it('setup() calls setHelp and setBloom', async () => {
    await setupScene()
    expect(ctx.setHelp).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalled()
  })

  it('setup() adds an inner shell and outward scales', async () => {
    await setupScene()
    const meshes = ctx.scene.children.filter(o => o instanceof Three.Mesh)
    expect(meshes.length).toBeGreaterThan(20)
  })

  it('update() flares scales without throwing', async () => {
    await setupScene()
    expect(() => {
      ctx.elapsed = 0.2
      mod.update(ctx, 0.016)
      ctx.elapsed = 1.0
      mod.update(ctx, 0.016)
    }).not.toThrow()
  })

  it('teardown() removes meshes and stops the webcam', async () => {
    await setupScene()
    await Promise.resolve()
    const addCount = vi.mocked(ctx.add).mock.calls.length
    mod.teardown(ctx)
    expect(vi.mocked(ctx.remove).mock.calls.length).toBe(addCount)
    expect(mockTrack.stop).toHaveBeenCalled()
  })
})

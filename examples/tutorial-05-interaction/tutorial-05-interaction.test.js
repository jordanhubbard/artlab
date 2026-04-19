// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'
import { setup, update, teardown } from './tutorial-05-interaction.js'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx() {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })

  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = new Three.PerspectiveCamera(60, 800 / 600, 0.1, 1000)
  camera.position.set(0, 6, 12)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()

  return {
    Three,
    scene,
    camera,
    renderer: {
      domElement: canvas,
      shadowMap: { enabled: false },
      setSize: vi.fn(),
    },
    controls: { update: vi.fn(), target: new Three.Vector3(), enabled: true },
    labelRenderer: {
      render: vi.fn(),
      setSize: vi.fn(),
      domElement: document.createElement('div'),
    },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
  }
}

describe('tutorial-05-interaction', () => {
  let ctx

  beforeEach(() => {
    ctx = makeMockCtx()
  })

  afterEach(() => {
    // Clean up any lingering event listeners if teardown wasn't called
    if (ctx._onMouseMove) window.removeEventListener('mousemove', ctx._onMouseMove)
    if (ctx._onClick) window.removeEventListener('click', ctx._onClick)
    if (ctx._onKey) window.removeEventListener('keydown', ctx._onKey)
  })

  it('setup() does not throw', () => {
    expect(() => setup(ctx)).not.toThrow()
  })

  it('creates a 5x5 grid of 25 cubes after setup', () => {
    setup(ctx)
    expect(Array.isArray(ctx._cubes)).toBe(true)
    expect(ctx._cubes.length).toBe(25)
  })

  it('update() runs 3 frames without throwing', () => {
    setup(ctx)
    for (let i = 1; i <= 3; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() removes event listeners and does not throw', () => {
    setup(ctx)

    // Spy on removeEventListener to verify it is called
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    expect(() => teardown(ctx)).not.toThrow()

    const calls = removeSpy.mock.calls.map(c => c[0])
    expect(calls).toContain('mousemove')
    expect(calls).toContain('click')
    expect(calls).toContain('keydown')

    removeSpy.mockRestore()
  })
})

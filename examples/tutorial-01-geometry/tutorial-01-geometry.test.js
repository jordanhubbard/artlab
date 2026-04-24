// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'
import { setup, update, teardown } from './tutorial-01-geometry.js'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  Object.defineProperty(canvas, 'clientWidth',  { configurable: true, get: () => 800 })
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, get: () => 600 })
  container.appendChild(canvas)

  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new Three.Vector3(0, 2, 9),
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
    setHelp:  vi.fn(),
    elapsed: 0,
  }
}

describe('tutorial-01-geometry', () => {
  let ctx

  beforeEach(() => {
    ctx = makeMockCtx()
  })

  it('setup() does not throw', () => {
    expect(() => setup(ctx)).not.toThrow()
  })

  it('creates 5 meshes and 5 labels after setup', () => {
    setup(ctx)
    expect(ctx._meshes.length).toBe(5)
    expect(ctx._labels.length).toBe(5)
  })

  it('update() runs 3 frames without throwing', () => {
    setup(ctx)
    for (let i = 0; i < 3; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() does not throw', () => {
    setup(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

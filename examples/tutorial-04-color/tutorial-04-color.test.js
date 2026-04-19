// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import { setup, update, teardown } from './tutorial-04-color.js'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx() {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })

  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new THREE.Vector3(0, 2, 9),
    lookAt: vi.fn(),
    fov: 60,
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
    projectionMatrix: new THREE.Matrix4(),
    matrixWorldInverse: new THREE.Matrix4(),
  }

  return {
    THREE,
    scene,
    camera,
    renderer: {
      domElement: canvas,
      shadowMap: { enabled: false },
      setSize: vi.fn(),
    },
    controls: { update: vi.fn(), target: new THREE.Vector3(), enabled: true },
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

describe('tutorial-04-color', () => {
  let ctx

  beforeEach(() => {
    ctx = makeMockCtx()
  })

  it('setup() does not throw', () => {
    expect(() => setup(ctx)).not.toThrow()
  })

  it('creates a 4x4 grid of 16 spheres after setup', () => {
    setup(ctx)
    expect(Array.isArray(ctx._spheres)).toBe(true)
    expect(ctx._spheres.length).toBe(16)
  })

  it('update() runs 3 frames without throwing', () => {
    setup(ctx)
    for (let i = 1; i <= 3; i++) {
      ctx.elapsed = i * 0.016
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() does not throw', () => {
    setup(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

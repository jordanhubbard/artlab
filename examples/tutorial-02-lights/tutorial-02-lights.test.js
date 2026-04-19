// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import { setup, update, teardown } from './tutorial-02-lights.js'

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

describe('tutorial-02-lights', () => {
  let ctx

  beforeEach(() => {
    ctx = makeMockCtx()
  })

  it('setup() does not throw', () => {
    expect(() => setup(ctx)).not.toThrow()
  })

  it('_lights array exists and is populated after setup', () => {
    setup(ctx)
    expect(Array.isArray(ctx._lights)).toBe(true)
    expect(ctx._lights.length).toBeGreaterThan(0)
  })

  it('update() cycles modes across 3 frames at increasing elapsed time', () => {
    setup(ctx)
    // Advance past CYCLE_DURATION (4s) to trigger a mode change
    ctx.elapsed = 4.1
    expect(() => update(ctx, 0.016)).not.toThrow()
    // Advance past another cycle
    ctx.elapsed = 8.2
    expect(() => update(ctx, 0.016)).not.toThrow()
    ctx.elapsed = 12.3
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('teardown() does not throw', () => {
    setup(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// ── Mock ctx ──────────────────────────────────────────────────────────────────

function makeMockCtx(overrides = {}) {
  const scene = {
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
  }
  const camera = {
    position: new THREE.Vector3(0, 0, 50),
    lookAt: vi.fn(),
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
    fov: 60,
  }
  const controls = {
    update: vi.fn(),
    enableDamping: true,
    target: new THREE.Vector3(),
  }
  const renderer = {
    domElement: document.createElement('canvas'),
    setSize: vi.fn(),
    render: vi.fn(),
    shadowMap: { enabled: false },
    toneMapping: 0,
  }

  function sphere(radius = 1, detail = 32) {
    return new THREE.SphereGeometry(radius, detail, detail)
  }
  function plane(w = 1, h = 1) {
    return new THREE.PlaneGeometry(w, h)
  }
  function mesh(geometry, options = {}) {
    const { color = 0xffffff, roughness = 0.7, metalness = 0.0 } = options
    return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness, metalness }))
  }
  function ambient(color = 0x404040, intensity = 1) {
    return new THREE.AmbientLight(color, intensity)
  }
  function point(color = 0xffffff, intensity = 1, distance = 0, decay = 2) {
    return new THREE.PointLight(color, intensity, distance, decay)
  }
  function directional(color = 0xffffff, intensity = 1) {
    return new THREE.DirectionalLight(color, intensity)
  }

  const ctx = {
    THREE,
    scene,
    camera,
    renderer,
    controls,
    labelRenderer: {
      render: vi.fn(),
      setSize: vi.fn(),
      domElement: document.createElement('div'),
    },
    add: vi.fn((obj) => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    sphere,
    plane,
    mesh,
    ambient,
    point,
    directional,
    ...overrides,
  }
  return ctx
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('wave-sculpture', () => {
  let ctx
  let setup, update

  beforeEach(async () => {
    ctx = makeMockCtx()
    ;({ setup, update } = await import('./wave-sculpture.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() creates a 15×15 grid of balls', () => {
    setup(ctx)
    expect(Array.isArray(ctx._balls)).toBe(true)
    expect(ctx._balls.length).toBe(225)
  })

  it('update() runs 3 frames without throwing', () => {
    setup(ctx)
    const frames = [0, 0.016, 0.032]
    for (const elapsed of frames) {
      ctx.elapsed = elapsed
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('update() changes ball y positions over time', () => {
    setup(ctx)
    ctx.elapsed = 0
    update(ctx, 0.016)
    const yBefore = ctx._balls[0].position.y

    ctx.elapsed = 1.5
    update(ctx, 0.016)
    const yAfter = ctx._balls[0].position.y

    // Wave positions must differ between t=0 and t=1.5
    expect(yBefore).not.toBeCloseTo(yAfter, 3)
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// ── Mock ctx ──────────────────────────────────────────────────────────────────

function makeMockCtx(overrides = {}) {
  const scene = {
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
  }
  const camera = {
    position: new Three.Vector3(0, 0, 50),
    lookAt: vi.fn(),
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
    fov: 60,
  }
  const controls = {
    update: vi.fn(),
    enableDamping: true,
    target: new Three.Vector3(),
  }
  const renderer = {
    domElement: document.createElement('canvas'),
    setSize: vi.fn(),
    render: vi.fn(),
    shadowMap: { enabled: false },
    toneMapping: 0,
  }

  function sphere(radius = 1, detail = 32) {
    return new Three.SphereGeometry(radius, detail, detail)
  }
  function mesh(geometry, options = {}) {
    const { color = 0xffffff, roughness = 0.7, metalness = 0.0 } = options
    return new Three.Mesh(geometry, new Three.MeshStandardMaterial({ color, roughness, metalness }))
  }
  function ambient(color = 0x404040, intensity = 1) {
    return new Three.AmbientLight(color, intensity)
  }
  function point(color = 0xffffff, intensity = 1, distance = 0, decay = 2) {
    return new Three.PointLight(color, intensity, distance, decay)
  }

  const ctx = {
    Three,
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
    mesh,
    ambient,
    point,
    ...overrides,
  }
  return ctx
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('particle-storm', () => {
  let ctx
  let setup, update

  beforeEach(async () => {
    ctx = makeMockCtx()
    ;({ setup, update } = await import('./particle-storm.js'))
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() creates 500 particles', () => {
    setup(ctx)
    expect(Array.isArray(ctx._particles)).toBe(true)
    expect(ctx._particles.length).toBe(500)
  })

  it('update() runs 3 frames without throwing', () => {
    setup(ctx)
    const frames = [0, 0.016, 0.032]
    for (const elapsed of frames) {
      ctx.elapsed = elapsed
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })
})

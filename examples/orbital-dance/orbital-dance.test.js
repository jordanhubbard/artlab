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
    near: 0.1,
    far: 200000,
    updateProjectionMatrix: vi.fn(),
    fov: 60,
  }
  const controls = {
    update: vi.fn(),
    enableDamping: true,
    enabled: true,
    target: new Three.Vector3(),
  }
  const renderer = {
    domElement: document.createElement('canvas'),
    setSize: vi.fn(),
    render: vi.fn(),
    shadowMap: { enabled: false, type: 0 },
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
    setHelp:  vi.fn(),
    elapsed: 0,
    sphere,
    mesh,
    ambient,
    point,
    ...overrides,
  }
  return ctx
}

function runFrames(mod, ctx, times) {
  for (const t of times) {
    ctx.elapsed = t
    mod.update(ctx, 1 / 60)
  }
}

const BODY_COUNT = 5

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('orbital-dance — Luminous Choreography', () => {
  let ctx, mod

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    mod = await import('./orbital-dance.js')
  })

  it('setup() completes without throwing and populates the scene', () => {
    expect(() => mod.setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
  })

  it('setup() calls ctx.setHelp before adding anything to the scene', () => {
    mod.setup(ctx)
    expect(ctx.setHelp).toHaveBeenCalledTimes(1)
    const [help] = ctx.setHelp.mock.calls[0]
    expect(typeof help).toBe('string')
    expect(help.length).toBeGreaterThan(10)
    expect(ctx.setHelp.mock.invocationCallOrder[0])
      .toBeLessThan(ctx.add.mock.invocationCallOrder[0])
  })

  it('setup() creates five occluding celestial bodies large enough to eclipse', () => {
    mod.setup(ctx)
    expect(Array.isArray(ctx._bodies)).toBe(true)
    expect(ctx._bodies.length).toBe(BODY_COUNT)
    for (const b of ctx._bodies) {
      expect(b.mesh).toBeInstanceOf(Three.Mesh)
      expect(b.mesh.geometry.parameters.radius).toBeGreaterThanOrEqual(0.6)
      expect(b.mesh.castShadow).toBe(true)
      expect(b.mesh.receiveShadow).toBe(true)
    }
  })

  it('setup() gives every body a continuous line trail and a luminous ribbon', () => {
    mod.setup(ctx)
    for (const b of ctx._bodies) {
      expect(b.line).toBeInstanceOf(Three.Line)
      expect(b.ribbon).toBeInstanceOf(Three.Mesh)

      const linePos = b.line.geometry.getAttribute('position')
      expect(linePos.count).toBeGreaterThanOrEqual(48)
      expect(b.line.geometry.getAttribute('color')).toBeTruthy()

      const ribbonPos = b.ribbon.geometry.getAttribute('position')
      expect(ribbonPos.count).toBe(linePos.count * 2)
      expect(b.ribbon.geometry.getIndex()).toBeTruthy()
    }
  })

  it('trail buffers are fixed size and reused across frames', () => {
    mod.setup(ctx)
    const body = ctx._bodies[0]
    const lineArray   = body.line.geometry.getAttribute('position').array
    const ribbonArray = body.ribbon.geometry.getAttribute('position').array

    runFrames(mod, ctx, [0.5, 1.0, 1.5])

    expect(body.line.geometry.getAttribute('position').array).toBe(lineArray)
    expect(body.ribbon.geometry.getAttribute('position').array).toBe(ribbonArray)
    expect(ctx.add).toHaveBeenCalledTimes(ctx._objects.length)
  })

  it('setup() creates translucent orbital veils on intersecting planes', () => {
    mod.setup(ctx)
    expect(ctx._bodies.length).toBe(BODY_COUNT)

    const tilts = new Set()
    for (const b of ctx._bodies) {
      expect(b.veil).toBeInstanceOf(Three.Mesh)
      expect(b.veil.material.transparent).toBe(true)
      expect(b.veil.material.opacity).toBeLessThan(0.5)
      expect(b.group).toBeInstanceOf(Three.Group)
      tilts.add(b.group.rotation.x.toFixed(4))
    }
    expect(tilts.size).toBeGreaterThanOrEqual(3)
  })

  it('setup() stages a lit backdrop instead of an empty black void', () => {
    mod.setup(ctx)
    expect(ctx._backdrop).toBeInstanceOf(Three.Mesh)
    expect(ctx._starfield).toBeInstanceOf(Three.Points)
    expect(ctx._starfield.geometry.getAttribute('position').count).toBeGreaterThan(200)
    expect(ctx._star).toBeInstanceOf(Three.Mesh)
    expect(ctx._star.geometry.parameters.radius).toBeGreaterThanOrEqual(1.2)
  })

  it('first frame is already composed: bodies spread out with populated trails', () => {
    mod.setup(ctx)

    const radii = ctx._bodies.map(b => Math.hypot(b.mesh.position.x, b.mesh.position.z))
    expect(new Set(radii.map(r => r.toFixed(3))).size).toBe(BODY_COUNT)

    const angles = ctx._bodies.map(b => Math.atan2(b.mesh.position.z, b.mesh.position.x))
    expect(new Set(angles.map(a => a.toFixed(3))).size).toBe(BODY_COUNT)

    for (const b of ctx._bodies) {
      const arr = b.line.geometry.getAttribute('position').array
      expect(arr.some(v => v !== 0)).toBe(true)
      const head = [arr[0], arr[1], arr[2]]
      const tail = [arr[arr.length - 3], arr[arr.length - 2], arr[arr.length - 1]]
      expect(Math.hypot(head[0] - tail[0], head[1] - tail[1], head[2] - tail[2]))
        .toBeGreaterThan(0.5)
    }
  })

  it('update() tracks eclipse occlusion per body', () => {
    mod.setup(ctx)
    runFrames(mod, ctx, [0, 0.5, 1.0])

    expect(ctx._eclipse.length).toBe(BODY_COUNT)
    for (let i = 0; i < BODY_COUNT; i++) {
      expect(Number.isFinite(ctx._eclipse[i])).toBe(true)
      expect(ctx._eclipse[i]).toBeGreaterThanOrEqual(0)
      expect(ctx._eclipse[i]).toBeLessThanOrEqual(1)
    }
  })

  it('update() moves bodies along their orbits without throwing', () => {
    mod.setup(ctx)
    const before = ctx._bodies[0].mesh.position.clone()
    expect(() => runFrames(mod, ctx, [0, 0.016, 0.032, 4, 9])).not.toThrow()
    expect(ctx._bodies[0].mesh.position.distanceTo(before)).toBeGreaterThan(0.01)
  })

  it('camera moves cinematically: orbiting, rising, and changing distance', () => {
    mod.setup(ctx)

    const samples = [0, 5, 11, 19].map(t => {
      ctx.elapsed = t
      mod.update(ctx, 1 / 60)
      return ctx.camera.position.clone()
    })

    const distances = samples.map(p => p.length())
    expect(Math.max(...distances) - Math.min(...distances)).toBeGreaterThan(1)

    const heights = samples.map(p => p.y)
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(1)

    expect(samples[0].distanceTo(samples[2])).toBeGreaterThan(1)
    expect(ctx.camera.lookAt).toHaveBeenCalled()
  })

  it('teardown() disposes every geometry and material it created', () => {
    mod.setup(ctx)
    expect(Array.isArray(ctx._disposables)).toBe(true)
    expect(ctx._disposables.length).toBeGreaterThan(10)

    const spies = ctx._disposables.map(d => vi.spyOn(d, 'dispose'))
    mod.teardown(ctx)
    for (const spy of spies) expect(spy).toHaveBeenCalled()
  })

  it('teardown() removes every object it added to the scene', () => {
    mod.setup(ctx)
    const objects = [...ctx._objects]
    expect(objects.length).toBeGreaterThan(0)

    mod.teardown(ctx)
    for (const obj of objects) expect(ctx.remove).toHaveBeenCalledWith(obj)
  })

  it('teardown() restores the controls and renderer state it changed', () => {
    ctx.controls.enabled = false
    ctx.renderer.shadowMap.enabled = false

    mod.setup(ctx)
    mod.teardown(ctx)

    expect(ctx.controls.enabled).toBe(false)
    expect(ctx.renderer.shadowMap.enabled).toBe(false)
  })

  it('teardown() is safe to call twice', () => {
    mod.setup(ctx)
    mod.teardown(ctx)
    expect(() => mod.teardown(ctx)).not.toThrow()
  })
})

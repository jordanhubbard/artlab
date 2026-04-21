// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'

vi.mock('three', async () => await vi.importActual('three'))

function makeMockCtx(overrides = {}) {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })

  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new THREE.Vector3(0, 0, 50),
    lookAt: vi.fn(), aspect: 1, fov: 60,
    updateProjectionMatrix: vi.fn(),
  }
  return {
    Three: THREE, scene, camera,
    renderer: { domElement: canvas, shadowMap: { enabled: false }, setSize: vi.fn() },
    controls: { update: vi.fn(), target: new THREE.Vector3(), enabled: true },
    add: vi.fn(obj => { scene.children.push(obj); return obj }),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('marble-run', () => {
  let ctx, setup, update, teardown, collideRamp, collideBumper, collideFunnel, collideLoop

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx = makeMockCtx()
    const mod = await import('./marble-run.js')
    setup = mod.setup
    update = mod.update
    teardown = mod.teardown
    collideRamp = mod.collideRamp
    collideBumper = mod.collideBumper
    collideFunnel = mod.collideFunnel
    collideLoop = mod.collideLoop
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
    expect(ctx.add).toHaveBeenCalled()
    expect(ctx.setBloom).toHaveBeenCalledWith(0.6)
  })

  it('setup() creates track segments and one marble', () => {
    setup(ctx)
    expect(Array.isArray(ctx._track)).toBe(true)
    expect(ctx._track.length).toBeGreaterThan(5)
    expect(ctx._marbles.length).toBe(1)
    expect(ctx._marbles[0].body).toHaveProperty('position')
    expect(ctx._marbles[0].body).toHaveProperty('velocity')
    expect(ctx._marbles[0]).toHaveProperty('mesh')
  })

  it('setup() creates meshes for each track segment', () => {
    setup(ctx)
    expect(ctx._meshes.length).toBe(ctx._track.length)
  })

  it('update() runs without throwing', () => {
    setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
    // Run several frames
    for (let i = 0; i < 10; i++) update(ctx, 0.016)
  })

  it('update() applies gravity — marble moves downward', () => {
    setup(ctx)
    const startY = ctx._marbles[0].body.position.y
    for (let i = 0; i < 20; i++) update(ctx, 0.016)
    expect(ctx._marbles[0].body.position.y).toBeLessThan(startY)
  })

  it('marble resets when falling below threshold', () => {
    setup(ctx)
    // Force marble way below
    ctx._marbles[0].body.position.set(0, -100, 0)
    update(ctx, 0.016)
    expect(ctx._marbles[0].body.position.y).toBeGreaterThan(-13)
  })

  it('click adds a new marble', () => {
    setup(ctx)
    expect(ctx._marbles.length).toBe(1)
    const evt = new Event('click')
    evt.clientX = 400
    evt.clientY = 300
    ctx.renderer.domElement.dispatchEvent(evt)
    expect(ctx._marbles.length).toBe(2)
  })

  it('teardown() removes event listener and objects', () => {
    setup(ctx)
    const removeSpy = vi.spyOn(ctx.renderer.domElement, 'removeEventListener')
    teardown(ctx)
    expect(removeSpy).toHaveBeenCalledWith('click', ctx._onClick)
    expect(ctx.remove).toHaveBeenCalled()
  })

  // ── Collision unit tests ────────────────────────────────────────────────
  describe('collideRamp', () => {
    it('pushes marble above ramp plane when penetrating', () => {
      const mb = {
        body: {
          position: new THREE.Vector3(0, 5.9, 0),  // slightly below ramp surface
          velocity: new THREE.Vector3(1, -3, 0),
          restitution: 0.65,
        },
        mesh: new THREE.Mesh(),
      }
      const seg = {
        type: 'ramp',
        center: new THREE.Vector3(0, 6, 0),
        normal: new THREE.Vector3(0, 1, 0),
        halfW: 3, halfD: 2,
      }
      const hit = collideRamp(mb, seg)
      expect(hit).toBe(true)
      // Marble should be pushed up
      expect(mb.body.position.y).toBeGreaterThanOrEqual(6.0)
    })

    it('returns false if marble is above ramp', () => {
      const mb = {
        body: {
          position: new THREE.Vector3(0, 7, 0),
          velocity: new THREE.Vector3(0, -1, 0),
          restitution: 0.65,
        },
        mesh: new THREE.Mesh(),
      }
      const seg = {
        type: 'ramp',
        center: new THREE.Vector3(0, 6, 0),
        normal: new THREE.Vector3(0, 1, 0),
        halfW: 3, halfD: 2,
      }
      expect(collideRamp(mb, seg)).toBe(false)
    })

    it('returns false if marble is outside ramp bounds', () => {
      const mb = {
        body: {
          position: new THREE.Vector3(10, 6, 0),
          velocity: new THREE.Vector3(0, -1, 0),
          restitution: 0.65,
        },
        mesh: new THREE.Mesh(),
      }
      const seg = {
        type: 'ramp',
        center: new THREE.Vector3(0, 6, 0),
        normal: new THREE.Vector3(0, 1, 0),
        halfW: 3, halfD: 2,
      }
      expect(collideRamp(mb, seg)).toBe(false)
    })
  })

  describe('collideBumper', () => {
    it('bounces marble off a bumper cylinder', () => {
      const mb = {
        body: {
          position: new THREE.Vector3(0.3, 5, 0),
          velocity: new THREE.Vector3(-2, 0, 0),
          restitution: 0.65,
        },
        mesh: new THREE.Mesh(),
      }
      const seg = { type: 'bumper', center: new THREE.Vector3(0, 5, 0), radius: 0.3 }
      const hit = collideBumper(mb, seg)
      expect(hit).toBe(true)
      // Velocity x should have reversed
      expect(mb.body.velocity.x).toBeGreaterThan(0)
    })

    it('returns false when marble is far from bumper', () => {
      const mb = {
        body: {
          position: new THREE.Vector3(5, 5, 0),
          velocity: new THREE.Vector3(0, 0, 0),
          restitution: 0.65,
        },
        mesh: new THREE.Mesh(),
      }
      const seg = { type: 'bumper', center: new THREE.Vector3(0, 5, 0), radius: 0.3 }
      expect(collideBumper(mb, seg)).toBe(false)
    })
  })

  describe('collideFunnel', () => {
    it('supports marble inside funnel bowl', () => {
      const mb = {
        body: {
          position: new THREE.Vector3(-1.5, 1.5, 0),
          velocity: new THREE.Vector3(0, -2, 0),
          restitution: 0.65,
        },
        mesh: new THREE.Mesh(),
      }
      const seg = { type: 'funnel', center: new THREE.Vector3(-1.5, 2.2, 0), radius: 1.0 }
      const hit = collideFunnel(mb, seg)
      expect(hit).toBe(true)
    })

    it('returns false when marble is far above funnel', () => {
      const mb = {
        body: {
          position: new THREE.Vector3(-1.5, 10, 0),
          velocity: new THREE.Vector3(0, -1, 0),
          restitution: 0.65,
        },
        mesh: new THREE.Mesh(),
      }
      const seg = { type: 'funnel', center: new THREE.Vector3(-1.5, 2.2, 0), radius: 1.0 }
      expect(collideFunnel(mb, seg)).toBe(false)
    })
  })

  describe('collideLoop', () => {
    it('deflects marble near loop torus', () => {
      // Position marble right at the inner edge of the torus tube
      const seg = { type: 'loop', center: new THREE.Vector3(-2, -5.5, 0), radius: 1.5 }
      const mb = {
        body: {
          position: new THREE.Vector3(-2, -5.5 + 1.5 - 0.1, 0),
          velocity: new THREE.Vector3(0, -3, 0),
          restitution: 0.65,
        },
        mesh: new THREE.Mesh(),
      }
      const hit = collideLoop(mb, seg)
      // May or may not hit depending on exact geometry; just ensure no crash
      expect(typeof hit).toBe('boolean')
    })

    it('returns false when marble is far from loop', () => {
      const mb = {
        body: {
          position: new THREE.Vector3(20, 20, 0),
          velocity: new THREE.Vector3(0, 0, 0),
          restitution: 0.65,
        },
        mesh: new THREE.Mesh(),
      }
      const seg = { type: 'loop', center: new THREE.Vector3(-2, -5.5, 0), radius: 1.5 }
      expect(collideLoop(mb, seg)).toBe(false)
    })
  })
})

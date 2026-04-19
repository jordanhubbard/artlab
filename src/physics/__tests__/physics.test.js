/**
 * Physics engine test suite for Artlab.
 *
 * OrbitalWorld uses TIME_YEAR_SECS = 120 (one Earth year = 120 scene-seconds)
 * and AU_SCALE = 100 (1 AU = 100 scene units).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OrbitalWorld } from '../OrbitalWorld.js'
import { ParticleWorld } from '../ParticleWorld.js'
import { RigidWorld } from '../RigidWorld.js'
import { PhysicsComposer } from '../PhysicsComposer.js'
import { AU_SCALE, TIME_YEAR_SECS } from '../../utils/constants.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function vec3Length({ x, y, z }) {
  return Math.sqrt(x * x + y * y + z * z)
}

/** Earth orbital descriptor (IRL: e=0.0167, i=0°, period=1yr) */
const EARTH_DESC = {
  type: 'orbital',
  semiMajorAxis: 1.0,
  eccentricity: 0.0167,
  inclination: 0,
  period: 1.0,
}

/** Mercury orbital descriptor (a=0.387 AU, period≈0.241 yr) */
const MERCURY_DESC = {
  type: 'orbital',
  semiMajorAxis: 0.387,
  eccentricity: 0.2056,
  inclination: 7.0,
  period: 0.2408,
}

// ---------------------------------------------------------------------------
// OrbitalWorld
// ---------------------------------------------------------------------------

describe('OrbitalWorld', () => {
  let world

  beforeEach(() => {
    world = new OrbitalWorld()
  })

  it('addBody stores an orbital body and getTransform returns null before step', () => {
    world.addBody('earth', EARTH_DESC)
    // Before any step the stored position is the zero-init value; getTransform
    // should still return an object (not null) because the body exists.
    const t = world.getTransform('earth')
    expect(t).not.toBeNull()
    expect(t).toHaveProperty('position')
    expect(t).toHaveProperty('rotation')
  })

  it('addBody throws for non-orbital desc type', () => {
    expect(() =>
      world.addBody('bad', { type: 'rigid', bodyType: 'dynamic' })
    ).toThrow("expected type 'orbital'")
  })

  it('step updates Earth position — length ≈ 100 ± 5 scene units (1 AU)', () => {
    world.addBody('earth', EARTH_DESC)
    world.step(1, 1)  // small elapsed, Earth should be near perihelion ≈ 1 AU
    const { position } = world.getTransform('earth')
    const len = vec3Length(position)
    expect(len).toBeGreaterThan(95)
    expect(len).toBeLessThan(105)
  })

  it('step updates Mercury position — length is within Mercury orbital range (perihelion≈30.7, aphelion≈46.7 scene units)', () => {
    world.addBody('mercury', MERCURY_DESC)
    world.step(1, 1)
    const { position } = world.getTransform('mercury')
    const len = vec3Length(position)
    // Mercury's perihelion: a*(1-e)*AU_SCALE = 0.387*0.7944*100 ≈ 30.7
    // Mercury's aphelion:   a*(1+e)*AU_SCALE = 0.387*1.2056*100 ≈ 46.7
    // Allow 2 units of tolerance around that range.
    expect(len).toBeGreaterThan(28.7)
    expect(len).toBeLessThan(48.7)
  })

  it('getTransform returns { position, rotation } after a step', () => {
    world.addBody('earth', EARTH_DESC)
    world.step(10, 1)
    const t = world.getTransform('earth')
    expect(t).not.toBeNull()
    expect(t.position).toHaveProperty('x')
    expect(t.position).toHaveProperty('y')
    expect(t.position).toHaveProperty('z')
    expect(t.rotation).toMatchObject({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('removeBody causes getTransform to return null', () => {
    world.addBody('earth', EARTH_DESC)
    world.step(5, 1)
    world.removeBody('earth')
    expect(world.getTransform('earth')).toBeNull()
  })

  it('Earth completes ~one orbit in TIME_YEAR_SECS scene-seconds (closed orbit, ≤5 units apart)', () => {
    world.addBody('earth', EARTH_DESC)

    // Position at t=0 (perihelion, near +x axis)
    world.step(0, 0)
    const p0 = { ...world.getTransform('earth').position }

    // Position after one full orbital period
    world.step(TIME_YEAR_SECS, TIME_YEAR_SECS)
    const p1 = { ...world.getTransform('earth').position }

    const dx = p1.x - p0.x
    const dy = p1.y - p0.y
    const dz = p1.z - p0.z
    const separation = Math.sqrt(dx * dx + dy * dy + dz * dz)

    // A perfect Kepler orbit is deterministic from elapsed, so t=0 and t=1yr
    // should give the same position (within floating-point tolerance).
    expect(separation).toBeLessThan(5)
  })
})

// ---------------------------------------------------------------------------
// ParticleWorld
// ---------------------------------------------------------------------------

describe('ParticleWorld', () => {
  let world

  beforeEach(() => {
    world = new ParticleWorld()
  })

  it('addBody with ParticleEmitterDesc creates the emitter', () => {
    world.addBody('fire', { type: 'particle', rate: 20, lifetime: 1.5 })
    // getParticles should return an array (possibly empty before any step)
    expect(Array.isArray(world.getParticles('fire'))).toBe(true)
  })

  it('addBody throws for non-particle desc type', () => {
    expect(() =>
      world.addBody('bad', { type: 'orbital', semiMajorAxis: 1 })
    ).toThrow("expected type 'particle'")
  })

  it('step spawns particles — getParticles returns non-empty array after enough steps', () => {
    world.addBody('smoke', { type: 'particle', rate: 50, lifetime: 5.0, speed: 3 })
    // step with dt large enough to accumulate several particles
    world.step(0.1, 0.1)
    world.step(0.2, 0.1)
    const particles = world.getParticles('smoke')
    expect(particles.length).toBeGreaterThan(0)
  })

  it('particles have position, velocity, and life-tracking properties', () => {
    world.addBody('spark', { type: 'particle', rate: 100, lifetime: 2.0 })
    world.step(0.1, 0.1)
    const particles = world.getParticles('spark')
    expect(particles.length).toBeGreaterThan(0)
    const p = particles[0]
    expect(p).toHaveProperty('position')
    expect(p.position).toHaveProperty('x')
    expect(p.position).toHaveProperty('y')
    expect(p.position).toHaveProperty('z')
    expect(p).toHaveProperty('velocity')
    // ParticleWorld tracks age + lifetime (life = lifetime - age effectively)
    expect(p).toHaveProperty('age')
    expect(p).toHaveProperty('lifetime')
  })

  it('particles age: age increases with each step', () => {
    world.addBody('jet', { type: 'particle', rate: 200, lifetime: 10.0 })
    world.step(0.05, 0.05)
    const before = world.getParticles('jet').map(p => p.age)
    world.step(0.15, 0.10)
    const after = world.getParticles('jet').map(p => p.age)
    // All particles that survived should have aged by ~0.10
    // (some may have been spawned in the second step, so just check that at
    //  least one particle has a larger age)
    const anyAged = after.some((a, i) => before[i] !== undefined && a > before[i])
    expect(anyAged).toBe(true)
  })

  it('particles are removed when age >= lifetime', () => {
    // Very short lifetime, moderate rate
    world.addBody('flash', { type: 'particle', rate: 100, lifetime: 0.05 })
    // First step spawns particles
    world.step(0.02, 0.02)
    const countAfterSpawn = world.getParticles('flash').length
    expect(countAfterSpawn).toBeGreaterThan(0)

    // Step well past lifetime — all original particles should be culled
    // Use a large dt so every old particle exceeds its lifetime
    world.step(1.0, 0.98)
    const surviving = world.getParticles('flash')
    // Any surviving particles must have been spawned in this last step
    // and must be younger than 0.1 s (2× the lifetime cap with random jitter)
    for (const p of surviving) {
      expect(p.age).toBeLessThan(0.1)
    }
  })

  it('removeBody stops particle spawning', () => {
    world.addBody('burst', { type: 'particle', rate: 50, lifetime: 5.0 })
    world.step(0.2, 0.2)  // produce some particles

    world.removeBody('burst')

    // After removal, getParticles returns empty default (emitter gone)
    const particles = world.getParticles('burst')
    expect(particles).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// PhysicsComposer
// ---------------------------------------------------------------------------

describe('PhysicsComposer', () => {
  it('adding an OrbitalWorld and stepping fans out to it', () => {
    const composer = new PhysicsComposer()
    const orbital = new OrbitalWorld()
    orbital.addBody('earth', EARTH_DESC)
    composer.add(orbital)

    composer.step(10, 1)

    // Confirm orbital world received the step — Earth should have moved
    const t = orbital.getTransform('earth')
    expect(t).not.toBeNull()
    expect(vec3Length(t.position)).toBeGreaterThan(90)
  })

  it('getTransform finds body in whichever world contains it', () => {
    const composer = new PhysicsComposer()
    const orbital = new OrbitalWorld()
    const particles = new ParticleWorld()

    orbital.addBody('earth', EARTH_DESC)
    particles.addBody('smoke', { type: 'particle', rate: 10, lifetime: 2 })

    composer.add(orbital).add(particles)
    composer.step(5, 1)

    // Earth is in the orbital world
    expect(composer.getTransform('earth')).not.toBeNull()

    // Smoke emitter is in the particle world
    expect(composer.getTransform('smoke')).not.toBeNull()
  })

  it('getTransform returns null for a body not in any world (OrbitalWorld-only composer)', () => {
    // OrbitalWorld.getTransform returns null for unknown ids, making this
    // safe to test without a ParticleWorld (which always returns a transform).
    const composer = new PhysicsComposer()
    const orbital = new OrbitalWorld()
    orbital.addBody('earth', EARTH_DESC)
    composer.add(orbital)
    composer.step(5, 1)

    expect(composer.getTransform('nonexistent')).toBeNull()
  })

  it('multiple worlds coexist and all receive step calls', () => {
    const composer = new PhysicsComposer()
    const o1 = new OrbitalWorld()
    const o2 = new OrbitalWorld()

    o1.addBody('earth', EARTH_DESC)
    o2.addBody('mercury', MERCURY_DESC)

    composer.add(o1).add(o2)
    composer.step(15, 1)

    const earthT = composer.getTransform('earth')
    const mercuryT = composer.getTransform('mercury')

    expect(earthT).not.toBeNull()
    expect(mercuryT).not.toBeNull()

    // Earth should be farther from origin than Mercury
    expect(vec3Length(earthT.position)).toBeGreaterThan(
      vec3Length(mercuryT.position)
    )
  })
})

// ---------------------------------------------------------------------------
// RigidWorld (stub — Rapier not installed)
// ---------------------------------------------------------------------------

describe('RigidWorld (stub, Rapier not installed)', () => {
  let world

  beforeEach(() => {
    // Suppress the expected console.warn from the constructor and addBody
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('constructor does not throw', () => {
    expect(() => { world = new RigidWorld() }).not.toThrow()
  })

  it('addBody does not throw and stores the body', () => {
    world = new RigidWorld()
    expect(() =>
      world.addBody('box1', {
        type: 'rigid',
        bodyType: 'dynamic',
        shape: { type: 'box' },
        initialPosition: { x: 1, y: 2, z: 3 },
        initialRotation: { x: 0, y: 0, z: 0, w: 1 },
      })
    ).not.toThrow()
  })

  it('step does not throw (no-op without Rapier)', () => {
    world = new RigidWorld()
    world.addBody('box1', {
      type: 'rigid',
      bodyType: 'dynamic',
      shape: { type: 'sphere', radius: 1 },
    })
    expect(() => world.step(1, 0.016)).not.toThrow()
  })

  it('getTransform returns a transform object for a known body (graceful stub behaviour)', () => {
    world = new RigidWorld()
    world.addBody('box1', {
      type: 'rigid',
      bodyType: 'dynamic',
      shape: { type: 'box' },
      initialPosition: { x: 5, y: 0, z: 0 },
    })
    world.step(1, 0.016)
    const t = world.getTransform('box1')
    // Stub stores the initialPosition and returns it; should not be null
    expect(t).not.toBeNull()
    expect(t).toHaveProperty('position')
    expect(t).toHaveProperty('rotation')
  })

  it('getTransform returns null for an unknown body', () => {
    world = new RigidWorld()
    expect(world.getTransform('ghost')).toBeNull()
  })
})

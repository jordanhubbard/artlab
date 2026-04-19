/**
 * artlab/physics/particles
 *
 * DSL-friendly wrappers around ParticleWorld for GPU-friendly particle systems.
 * Creates and manages Three.Points meshes that stay in sync with the CPU
 * simulation each frame.
 *
 * @module artlab/physics/particles
 *
 * @example
 *   import { createParticleWorld, emitter, forceField } from 'artlab/physics/particles'
 *   import * as Three from 'three'
 *
 *   const pworld = createParticleWorld()
 *
 *   const fire = emitter(pworld, scene, {
 *     rate: 60, speed: 4, spread: 25, lifetime: 1.5,
 *     color: 0xff6600, size: 0.15, gravity: 2,
 *   })
 *
 *   forceField(pworld, fire.emitterId, { x:0, y:2, z:0 }, 3, { x:0, y:5, z:0 })
 *
 *   // In render loop:
 *   fire.update(elapsed, dt)
 */

import { ParticleWorld } from '../../physics/ParticleWorld.js'
import * as Three from 'three'

export { ParticleWorld }

// ---------------------------------------------------------------------------
// Counter for unique IDs
// ---------------------------------------------------------------------------
let _nextId = 0
function _uid(prefix) { return `${prefix}_${_nextId++}` }

// ---------------------------------------------------------------------------
// createParticleWorld
// ---------------------------------------------------------------------------

/**
 * Create a new ParticleWorld simulation instance.
 *
 * Step it via `world.step(elapsed, dt)`, or let the emitter's `update()`
 * call handle stepping for you.
 *
 * @returns {ParticleWorld}
 *
 * @example
 *   const pworld = createParticleWorld()
 */
export function createParticleWorld() {
  return new ParticleWorld()
}

// ---------------------------------------------------------------------------
// emitter
// ---------------------------------------------------------------------------

/**
 * Create a particle emitter that drives both a ParticleWorld simulation and
 * a matching Three.Points mesh for rendering.
 *
 * The emitter is registered with `world` immediately.  Call `update(elapsed, dt)`
 * once per frame to advance the simulation and upload new positions to the GPU.
 *
 * @param {ParticleWorld} world  Particle simulation instance
 * @param {Three.Scene}   scene  Scene to attach the Points mesh to
 * @param {object}        [options]
 * @param {number}  [options.rate=20]         Particles spawned per second
 * @param {number}  [options.speed=5]         Initial speed (scene units / s)
 * @param {number}  [options.spread=30]       Half-angle cone spread in degrees
 * @param {number}  [options.lifetime=2]      Max particle lifetime in seconds
 * @param {number}  [options.color=0xffffff]  Particle colour (hex)
 * @param {number}  [options.size=0.1]        Point size in scene units
 * @param {number}  [options.gravity=0]       Downward gravity acceleration (scene units / s²)
 * @param {number}  [options.maxParticles=2000] Upper bound for the geometry buffer
 * @returns {{
 *   emitterId: string,
 *   points: Three.Points,
 *   update(elapsed: number, dt: number): void,
 *   dispose(): void,
 * }}
 *
 * @example
 *   const sparks = emitter(pworld, scene, { rate: 50, spread: 60, color: 0xffdd44 })
 *   // in render loop:
 *   sparks.update(elapsed, dt)
 */
export function emitter(world, scene, options = {}) {
  const {
    rate         = 20,
    speed        = 5,
    spread       = 30,
    lifetime     = 2,
    color        = 0xffffff,
    size         = 0.1,
    gravity      = 0,
    maxParticles = 2000,
  } = options

  const id = _uid('emitter')

  // Register with ParticleWorld
  world.addBody(id, {
    type:     'particle',
    rate,
    speed,
    spread,
    lifetime,
    gravity,
  })

  // Build a Three.Points mesh backed by a dynamic BufferGeometry
  const geometry = new Three.BufferGeometry()
  const positions = new Float32Array(maxParticles * 3)
  const posAttr = new Three.BufferAttribute(positions, 3)
  posAttr.setUsage(Three.DynamicDrawUsage)
  geometry.setAttribute('position', posAttr)
  // Start with zero draw range so no particles show until the first update
  geometry.setDrawRange(0, 0)

  const material = new Three.PointsMaterial({
    color,
    size,
    sizeAttenuation: true,
    depthWrite: false,
    transparent: true,
    opacity: 0.85,
  })

  const points = new Three.Points(geometry, material)
  scene.add(points)

  return {
    /** The ID used to address this emitter inside the ParticleWorld. */
    emitterId: id,

    /** The Three.js Points mesh — reposition or reparent as needed. */
    points,

    /**
     * Advance the simulation by `dt` seconds and upload positions to the GPU.
     *
     * Call once per frame, typically inside your animation loop.
     *
     * @param {number} elapsed  Total elapsed seconds (passed to world.step)
     * @param {number} dt       Delta time in seconds since last frame
     */
    update(elapsed, dt) {
      world.step(elapsed, dt)

      const particles = world.getParticles(id)
      const count = Math.min(particles.length, maxParticles)

      for (let i = 0; i < count; i++) {
        const p = particles[i]
        positions[i * 3]     = p.position.x
        positions[i * 3 + 1] = p.position.y
        positions[i * 3 + 2] = p.position.z
      }

      posAttr.needsUpdate = true
      geometry.setDrawRange(0, count)
    },

    /**
     * Remove the emitter from the world and dispose Three.js resources.
     */
    dispose() {
      world.removeBody(id)
      scene.remove(points)
      geometry.dispose()
      material.dispose()
    },
  }
}

// ---------------------------------------------------------------------------
// forceField
// ---------------------------------------------------------------------------

/**
 * Apply a constant force to all live particles belonging to `emitterId` that
 * fall within a sphere of the given `radius` centred on `center`.
 *
 * This is a one-shot application — call it every frame (inside your update
 * loop) to create a persistent field effect.
 *
 * Because ParticleWorld exposes particle state directly, we manipulate
 * velocities inline rather than going through an indirection layer.
 *
 * @param {ParticleWorld}   world      Simulation instance
 * @param {string}          emitterId  ID returned by emitter() as `.emitterId`
 * @param {{ x,y,z }}       center     World-space centre of the force sphere
 * @param {number}          radius     Radius of influence in scene units
 * @param {{ x,y,z }}       force      Force vector applied per second (impulse * dt expected at call site)
 *
 * @example
 *   // In render loop:
 *   forceField(pworld, sparks.emitterId, { x:0, y:1, z:0 }, 2, { x:0, y:3, z:0 })
 */
export function forceField(world, emitterId, center, radius, force) {
  const particles = world.getParticles(emitterId)
  const r2 = radius * radius

  for (const p of particles) {
    const dx = p.position.x - center.x
    const dy = p.position.y - center.y
    const dz = p.position.z - center.z
    if (dx * dx + dy * dy + dz * dz <= r2) {
      p.velocity.x += force.x
      p.velocity.y += force.y
      p.velocity.z += force.z
    }
  }
}

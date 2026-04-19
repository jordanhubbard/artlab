/**
 * artlab/physics/bindings
 *
 * Bridges the physics engine to DSL programs via a context-aware API.
 * DSL programs receive a `physics` object on their context, typically
 * created via createPhysics() and wired in by the scene runner.
 *
 * @module artlab/physics/bindings
 *
 * @example
 *   import { createPhysics, attachOrbit, attachRigid, createEmitter, setGravity }
 *     from 'artlab/physics/bindings'
 *
 *   const physics = createPhysics()
 *
 *   // Orbital body
 *   const handle = attachOrbit(physics, mesh, {
 *     semiMajorAxis: 1.5, eccentricity: 0.09, inclination: 1.85, period: 1.88
 *   })
 *
 *   // Rigid body
 *   const rb = attachRigid(physics, cube, {
 *     bodyType: 'dynamic', shape: { type: 'box', hx: 0.5, hy: 0.5, hz: 0.5 }, mass: 1
 *   })
 *   rb.applyImpulse({ x: 0, y: 10, z: 0 })
 *
 *   // Particle emitter
 *   const emitter = createEmitter(physics, { rate: 20, lifetime: 3, speed: 4 })
 *   const particles = emitter.getParticles()   // live particle array
 *
 *   // In render loop
 *   physics.step(elapsed, dt)
 *
 *   // Teardown
 *   physics.dispose()
 */

import { OrbitalWorld }  from '../../physics/OrbitalWorld.js'
import { RigidWorld }    from '../../physics/RigidWorld.js'
import { ParticleWorld } from '../../physics/ParticleWorld.js'
import { PhysicsComposer } from '../../physics/PhysicsComposer.js'

// ---------------------------------------------------------------------------
// Unique ID helper
// ---------------------------------------------------------------------------

let _nextId = 0
function _uid(prefix) {
  return `${prefix}_${++_nextId}`
}

// ---------------------------------------------------------------------------
// createPhysics
// ---------------------------------------------------------------------------

/**
 * Create a physics context to attach to a scene context.
 *
 * All three sub-worlds (orbital, rigid, particles) are instantiated and
 * registered with a PhysicsComposer so a single step() call advances all
 * simulations.
 *
 * @param {object} [options]
 * @param {boolean} [options.gravity=true]  Pre-apply Earth gravity (-9.81 on Y)
 *   to the rigid world.  Pass false to start with zero gravity.
 * @returns {{
 *   composer:  PhysicsComposer,
 *   orbital:   OrbitalWorld,
 *   rigid:     RigidWorld,
 *   particles: ParticleWorld,
 *   step(elapsed: number, dt: number): void,
 *   dispose(): void
 * }}
 *
 * @example
 *   const physics = createPhysics()
 *   // in render loop:
 *   physics.step(elapsed, dt)
 *   // on teardown:
 *   physics.dispose()
 */
export function createPhysics(options = {}) {
  const { gravity = true } = options

  const orbital   = new OrbitalWorld()
  const rigid     = new RigidWorld()
  const particles = new ParticleWorld()

  const composer = new PhysicsComposer()
  composer.add(orbital)
  composer.add(rigid)
  composer.add(particles)

  // Convenience: pre-set Earth gravity when the Rapier world is available.
  // RigidWorld exposes this once Rapier is initialized; harmless if not yet ready.
  if (gravity) {
    setGravity({ rigid }, { x: 0, y: -9.81, z: 0 })
  }

  return {
    composer,
    orbital,
    rigid,
    particles,

    /** Advance all sub-worlds. Call once per frame. */
    step(elapsed, dt) {
      composer.step(elapsed, dt)
    },

    /** Dispose all sub-worlds and free their resources. */
    dispose() {
      composer.dispose()
    },
  }
}

// ---------------------------------------------------------------------------
// attachOrbit
// ---------------------------------------------------------------------------

/**
 * Attach a scene object to a Keplerian orbital body in the physics context.
 * After each step() call the object's position is updated to match the body.
 *
 * @param {{ orbital: OrbitalWorld, composer: PhysicsComposer }} physicsCtx
 *   The context returned by createPhysics().
 * @param {object} obj   Any object with a numeric `.position.{x,y,z}`.
 * @param {OrbitalBodyDesc} desc  Orbital body descriptor.
 *   Required fields: semiMajorAxis, eccentricity, inclination, period.
 *   The `type` field is filled in automatically.
 * @returns {{ id: string, detach(): void }}
 *
 * @example
 *   const handle = attachOrbit(physics, marsMesh, {
 *     semiMajorAxis: 1.524, eccentricity: 0.093, inclination: 1.85, period: 1.88
 *   })
 *   // later:
 *   handle.detach()
 */
export function attachOrbit(physicsCtx, obj, desc) {
  const { orbital, composer } = physicsCtx
  const id = _uid('orbit')

  // Merge in the required type tag so callers don't have to spell it out.
  orbital.addBody(id, { ...desc, type: 'orbital' })

  // Install a per-step listener that copies the body transform to the object.
  // We wrap composer.step to inject our sync; the original step is preserved.
  const _originalStep = composer.step.bind(composer)
  function syncedStep(elapsed, dt) {
    _originalStep(elapsed, dt)
    const t = orbital.getTransform(id)
    if (t) {
      obj.position.x = t.position.x
      obj.position.y = t.position.y
      obj.position.z = t.position.z
    }
  }
  composer.step = syncedStep

  return {
    id,
    detach() {
      orbital.removeBody(id)
      // Restore the previous step (unwrap our closure).
      composer.step = _originalStep
    },
  }
}

// ---------------------------------------------------------------------------
// attachRigid
// ---------------------------------------------------------------------------

/**
 * Attach a scene object to a rigid body in the physics context.
 * After each step() call the object's position and quaternion are updated.
 *
 * @param {{ rigid: RigidWorld, composer: PhysicsComposer }} physicsCtx
 * @param {object} obj   Any object with `.position.{x,y,z}` and
 *   optionally `.quaternion.{x,y,z,w}`.
 * @param {RigidBodyDesc} desc  Rigid body descriptor.
 *   The `type` field is filled in automatically.
 * @returns {{
 *   id: string,
 *   detach(): void,
 *   applyForce(vec3: {x,y,z}): void,
 *   applyImpulse(vec3: {x,y,z}): void
 * }}
 *
 * @example
 *   const rb = attachRigid(physics, cube, {
 *     bodyType: 'dynamic',
 *     shape: { type: 'box', hx: 0.5, hy: 0.5, hz: 0.5 },
 *     mass: 1,
 *     restitution: 0.4,
 *   })
 *   rb.applyForce({ x: 0, y: 20, z: 0 })
 */
export function attachRigid(physicsCtx, obj, desc) {
  const { rigid, composer } = physicsCtx
  const id = _uid('rigid')

  rigid.addBody(id, { ...desc, type: 'rigid' })

  const _originalStep = composer.step.bind(composer)
  function syncedStep(elapsed, dt) {
    _originalStep(elapsed, dt)
    const t = rigid.getTransform(id)
    if (t) {
      obj.position.x = t.position.x
      obj.position.y = t.position.y
      obj.position.z = t.position.z
      // Write quaternion if the object supports it (THREE.Object3D does).
      if (obj.quaternion) {
        obj.quaternion.x = t.rotation.x
        obj.quaternion.y = t.rotation.y
        obj.quaternion.z = t.rotation.z
        obj.quaternion.w = t.rotation.w
      }
    }
  }
  composer.step = syncedStep

  return {
    id,

    detach() {
      rigid.removeBody(id)
      composer.step = _originalStep
    },

    /**
     * Apply a continuous force to the body (world-space).
     * @param {{ x: number, y: number, z: number }} vec3
     */
    applyForce(vec3) {
      rigid.applyForce(id, vec3)
    },

    /**
     * Apply an instantaneous impulse to the body (world-space).
     * Equivalent to applyForce but scaled for a single-frame push.
     * Falls back to applyForce when the backend does not distinguish them.
     * @param {{ x: number, y: number, z: number }} vec3
     */
    applyImpulse(vec3) {
      // RigidWorld does not yet expose a separate applyImpulse on the interface;
      // route through applyForce which the backend can handle as a delta-v.
      if (typeof rigid.applyImpulse === 'function') {
        rigid.applyImpulse(id, vec3)
      } else {
        rigid.applyForce(id, vec3)
      }
    },
  }
}

// ---------------------------------------------------------------------------
// createEmitter
// ---------------------------------------------------------------------------

/**
 * Create a particle emitter and register it in the physics context.
 * Particles are updated each step(); retrieve them for rendering via
 * `handle.getParticles()`.
 *
 * @param {{ particles: ParticleWorld, composer: PhysicsComposer }} physicsCtx
 * @param {ParticleEmitterDesc} desc  Emitter descriptor.
 *   The `type` field is filled in automatically.
 * @returns {{
 *   id: string,
 *   getParticles(): Array<{ position: {x,y,z}, velocity: {x,y,z}, age: number, lifetime: number }>,
 *   detach(): void
 * }}
 *
 * @example
 *   const emitter = createEmitter(physics, {
 *     rate: 30, lifetime: 2.5, speed: 6, spread: 20, gravity: 9.81
 *   })
 *   // in render loop — build instanced mesh from emitter.getParticles()
 *   const pts = emitter.getParticles()
 */
export function createEmitter(physicsCtx, desc) {
  const { particles } = physicsCtx
  const id = _uid('emitter')

  particles.addBody(id, { ...desc, type: 'particle' })

  return {
    id,

    /**
     * Return the current live particle array for this emitter.
     * @returns {Array<{ position: {x,y,z}, velocity: {x,y,z}, age: number, lifetime: number }>}
     */
    getParticles() {
      return particles.getParticles(id)
    },

    /** Remove the emitter and free its particles. */
    detach() {
      particles.removeBody(id)
    },
  }
}

// ---------------------------------------------------------------------------
// setGravity
// ---------------------------------------------------------------------------

/**
 * Set the gravity vector applied to all dynamic rigid bodies.
 *
 * When the Rapier backend is active this reconfigures the underlying world.
 * When running in stub mode the vector is stored and will be applied once
 * Rapier initializes (if RigidWorld exposes a setGravity hook).
 *
 * @param {{ rigid: RigidWorld }} physicsCtx
 * @param {{ x: number, y: number, z: number }} vec3  Gravity in m/s².
 *   Earth standard: { x: 0, y: -9.81, z: 0 }
 *
 * @example
 *   setGravity(physics, { x: 0, y: -1.62, z: 0 })   // lunar gravity
 *   setGravity(physics, { x: 0, y:  0,    z: 0 })   // zero-g
 */
export function setGravity(physicsCtx, vec3) {
  const { rigid } = physicsCtx
  // Store the desired gravity for when Rapier is (or becomes) available.
  rigid._pendingGravity = { ...vec3 }

  // If the Rapier world is already live, apply immediately.
  if (rigid._world) {
    rigid._world.gravity.x = vec3.x
    rigid._world.gravity.y = vec3.y
    rigid._world.gravity.z = vec3.z
  }
}

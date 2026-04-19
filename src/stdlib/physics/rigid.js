/**
 * artlab/physics/rigid
 *
 * DSL-friendly wrappers around the RigidWorld rigid-body physics engine.
 * Delegates simulation to RigidWorld (Rapier.js-backed, currently stubbed)
 * and syncs results to Three.js objects each frame.
 *
 * @module artlab/physics/rigid
 *
 * @example
 *   import { createRigidWorld, box, sphere, plane, joint } from 'artlab/physics/rigid'
 *
 *   const world = createRigidWorld()
 *
 *   const crate = box(world, mesh, { mass: 1, restitution: 0.4 })
 *   const ball  = sphere(world, ballMesh, { mass: 0.5, restitution: 0.8 })
 *   plane(world, [0, 1, 0], 0)                      // infinite floor at y=0
 *   const pin = joint(world, crate, ball)
 *
 *   // In render loop (pass elapsed seconds and dt):
 *   world.step(elapsed, dt)
 *   crate.update()
 *   ball.update()
 */

import { RigidWorld } from '../../physics/RigidWorld.js'

export { RigidWorld }

// ---------------------------------------------------------------------------
// Counter for generating unique body IDs
// ---------------------------------------------------------------------------
let _nextId = 0
function _uid(prefix) { return `${prefix}_${_nextId++}` }

// ---------------------------------------------------------------------------
// createRigidWorld
// ---------------------------------------------------------------------------

/**
 * Create a new RigidWorld simulation instance.
 *
 * The world must be stepped each frame:
 *   `world.step(elapsed, dt)`
 *
 * @returns {RigidWorld}
 *
 * @example
 *   const world = createRigidWorld()
 */
export function createRigidWorld() {
  return new RigidWorld()
}

// ---------------------------------------------------------------------------
// box
// ---------------------------------------------------------------------------

/**
 * Register a box-shaped rigid body and bind it to a Three.js scene object.
 *
 * After calling `world.step()` each frame, call `handle.update()` to copy
 * the simulated position / rotation back to `obj`.
 *
 * @param {RigidWorld} world     The rigid world to register with
 * @param {object}     obj       Three.js Object3D (or any object with .position / .quaternion)
 * @param {object}     [options]
 * @param {number}     [options.mass=1]          Mass in kg (0 = static/kinematic)
 * @param {number}     [options.restitution=0.3] Bounciness 0–1
 * @param {number}     [options.friction=0.5]    Surface friction 0–1
 * @returns {{ id: string, update(): void, applyForce(v: {x,y,z}): void, detach(): void }}
 *
 * @example
 *   const crate = box(world, mesh, { mass: 1, restitution: 0.4 })
 *   // in render loop:
 *   world.step(elapsed, dt)
 *   crate.update()
 */
export function box(world, obj, options = {}) {
  return _registerBody(world, obj, 'box', options)
}

// ---------------------------------------------------------------------------
// sphere
// ---------------------------------------------------------------------------

/**
 * Register a sphere-shaped rigid body and bind it to a Three.js scene object.
 *
 * @param {RigidWorld} world
 * @param {object}     obj
 * @param {object}     [options]
 * @param {number}     [options.mass=1]
 * @param {number}     [options.restitution=0.3]
 * @param {number}     [options.friction=0.5]
 * @returns {{ id: string, update(): void, applyForce(v: {x,y,z}): void, detach(): void }}
 *
 * @example
 *   const ball = sphere(world, ballMesh, { mass: 0.5, restitution: 0.8 })
 */
export function sphere(world, obj, options = {}) {
  return _registerBody(world, obj, 'sphere', options)
}

// ---------------------------------------------------------------------------
// plane
// ---------------------------------------------------------------------------

/**
 * Add a static infinite plane (e.g. floor or wall) to the world.
 *
 * The plane is fixed (mass = 0) and never produces a visual update handle.
 *
 * @param {RigidWorld} world
 * @param {number[]}   [normal=[0,1,0]]  Unit normal vector as [x, y, z]
 * @param {number}     [constant=0]      Signed distance from the origin along the normal
 * @returns {{ id: string, detach(): void }}
 *
 * @example
 *   plane(world, [0, 1, 0], 0)   // floor at y = 0
 *   plane(world, [0, 0, 1], -5)  // back wall at z = -5
 */
export function plane(world, normal = [0, 1, 0], constant = 0) {
  const id = _uid('plane')
  world.addBody(id, {
    type: 'plane',
    shape: 'plane',
    mass: 0,
    normal: { x: normal[0], y: normal[1], z: normal[2] },
    constant,
    initialPosition: { x: 0, y: 0, z: 0 },
    initialRotation: { x: 0, y: 0, z: 0, w: 1 },
  })
  return {
    id,
    /** Remove the plane from the world. */
    detach() { world.removeBody(id) },
  }
}

// ---------------------------------------------------------------------------
// joint
// ---------------------------------------------------------------------------

/**
 * Add a constraint joint between two body handles.
 *
 * Both `bodyA` and `bodyB` must be handles returned by `box()`, `sphere()`,
 * or other body-creating helpers.
 *
 * @param {RigidWorld} world
 * @param {{ id: string }} bodyA  Handle of the first body
 * @param {{ id: string }} bodyB  Handle of the second body
 * @param {object}         [options]
 * @param {'fixed'|'ball'|'revolute'|'prismatic'} [options.type='ball']
 *   Joint type (when Rapier is initialized)
 * @param {{ x,y,z }} [options.anchorA]  Local anchor on body A (default origin)
 * @param {{ x,y,z }} [options.anchorB]  Local anchor on body B (default origin)
 * @returns {{ id: string, detach(): void }}
 *
 * @example
 *   const pin = joint(world, crate, ball, { type: 'ball' })
 *   // later:
 *   pin.detach()
 */
export function joint(world, bodyA, bodyB, options = {}) {
  const id = _uid('joint')
  const {
    type    = 'ball',
    anchorA = { x: 0, y: 0, z: 0 },
    anchorB = { x: 0, y: 0, z: 0 },
  } = options

  world.addBody(id, {
    type: 'joint',
    shape: 'joint',
    mass: 0,
    jointType: type,
    bodyAId: bodyA.id,
    bodyBId: bodyB.id,
    anchorA,
    anchorB,
    initialPosition: { x: 0, y: 0, z: 0 },
    initialRotation: { x: 0, y: 0, z: 0, w: 1 },
  })

  return {
    id,
    /** Remove the joint from the world. */
    detach() { world.removeBody(id) },
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Shared logic for box() and sphere(): register a body and return a handle.
 *
 * @private
 */
function _registerBody(world, obj, shape, options) {
  const {
    mass        = 1,
    restitution = 0.3,
    friction    = 0.5,
  } = options

  const id = _uid(shape)

  // Snapshot initial transform from the Three.js object (if present)
  const pos = obj.position
    ? { x: obj.position.x, y: obj.position.y, z: obj.position.z }
    : { x: 0, y: 0, z: 0 }

  const rot = obj.quaternion
    ? { x: obj.quaternion.x, y: obj.quaternion.y, z: obj.quaternion.z, w: obj.quaternion.w }
    : { x: 0, y: 0, z: 0, w: 1 }

  world.addBody(id, {
    type: 'rigid',
    shape,
    mass,
    restitution,
    friction,
    initialPosition: pos,
    initialRotation: rot,
  })

  return {
    id,

    /**
     * Copy the latest simulated transform from the world to `obj`.
     * Call once per frame, after `world.step(elapsed, dt)`.
     */
    update() {
      const xform = world.getTransform(id)
      if (!xform) return
      const { position, rotation } = xform
      if (obj.position) {
        obj.position.x = position.x
        obj.position.y = position.y
        obj.position.z = position.z
      }
      if (obj.quaternion) {
        obj.quaternion.x = rotation.x
        obj.quaternion.y = rotation.y
        obj.quaternion.z = rotation.z
        obj.quaternion.w = rotation.w
      }
    },

    /**
     * Apply an impulse/force to this body.
     * @param {{ x: number, y: number, z: number }} v  Force vector
     */
    applyForce(v) {
      world.applyForce(id, v)
    },

    /** Remove this body from the simulation. */
    detach() {
      world.removeBody(id)
    },
  }
}

/**
 * @interface IPhysicsWorld
 * Common interface for all Artlab physics backends.
 */
export class IPhysicsWorld {
  /**
   * Add a physics body.
   * @param {string} id - unique body identifier
   * @param {PhysicsBodyDesc} desc
   */
  addBody(id, desc) { throw new Error('not implemented') }

  removeBody(id) { throw new Error('not implemented') }

  /**
   * Step the simulation by dt seconds.
   * @param {number} elapsed - total elapsed time in seconds
   * @param {number} dt - delta time in seconds
   */
  step(elapsed, dt) { throw new Error('not implemented') }

  /**
   * Get the current world-space transform of a body.
   * @param {string} id
   * @returns {{ position: {x,y,z}, rotation: {x,y,z,w} }}
   */
  getTransform(id) { throw new Error('not implemented') }

  /**
   * Apply a force to a body (rigid body only).
   * @param {string} id
   * @param {{ x: number, y: number, z: number }} force
   */
  applyForce(id, force) {}

  /**
   * Register a collision callback (rigid body only).
   * @param {(a: string, b: string) => void} callback
   */
  onCollision(callback) {}

  dispose() {}
}

/**
 * @typedef {OrbitalBodyDesc|RigidBodyDesc|ParticleEmitterDesc} PhysicsBodyDesc
 */

/**
 * @typedef {Object} OrbitalBodyDesc
 * @property {'orbital'} type
 * @property {number} semiMajorAxis - in AU
 * @property {number} eccentricity
 * @property {number} inclination - in degrees
 * @property {number} period - in Earth years
 * @property {number} [argPeriapsis] - degrees, default 0
 * @property {number} [raan] - right ascension of ascending node, degrees, default 0
 */

/**
 * @typedef {Object} RigidBodyDesc
 * @property {'rigid'} type
 * @property {'dynamic'|'static'|'kinematic'} bodyType
 * @property {{ type: 'sphere'|'box'|'capsule', [key: string]: any }} shape
 * @property {number} [mass]
 * @property {number} [restitution]
 * @property {number} [friction]
 * @property {{ x,y,z }} [initialPosition]
 * @property {{ x,y,z,w }} [initialRotation]
 */

/**
 * @typedef {Object} ParticleEmitterDesc
 * @property {'particle'} type
 * @property {number} [rate] - particles per second
 * @property {number} [lifetime] - seconds
 * @property {{ x,y,z }} [direction]
 * @property {number} [spread] - cone half-angle degrees
 * @property {number} [speed]
 * @property {number} [gravity]
 */

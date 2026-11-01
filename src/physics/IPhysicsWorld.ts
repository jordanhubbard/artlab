/**
 * @interface IPhysicsWorld
 * Common interface for all Artlab physics backends.
 */
export interface Vector { x: number; y: number; z: number }
export interface Transform { position: Vector; rotation: Vector & { w: number } }
export interface OrbitalBodyDesc {
  type: 'orbital'; semiMajorAxis: number; eccentricity: number; inclination: number; period: number
  argPeriapsis?: number; raan?: number
}
export interface RigidBodyDesc {
  type: 'rigid'; bodyType: 'dynamic' | 'static' | 'kinematic'
  shape: { type: 'sphere'; radius: number } | { type: 'box'; hx: number; hy: number; hz: number } | { type: 'capsule'; halfHeight: number; radius: number }
  mass?: number; restitution?: number; friction?: number
  initialPosition?: Vector; initialRotation?: Vector & { w: number }
}
export interface ParticleEmitterDesc {
  type: 'particle'; rate?: number; lifetime?: number; direction?: Vector; spread?: number; speed?: number; gravity?: number
}
export interface FluidBodyDesc {
  position?: Vector; count?: number; radius?: number; velocity?: Vector
  bounds?: { min: Vector; max: Vector }
}
export type PhysicsBodyDesc = OrbitalBodyDesc | RigidBodyDesc | ParticleEmitterDesc | FluidBodyDesc
export type CollisionCallback = (a: string, b: string) => void

export class IPhysicsWorld<Desc = PhysicsBodyDesc> {
  /**
   * Add a physics body.
   * @param {string} id - unique body identifier
   * @param {PhysicsBodyDesc} desc
   */
  addBody(id: string, desc: Desc): void { throw new Error('not implemented') }

  removeBody(id: string): void { throw new Error('not implemented') }

  /**
   * Step the simulation by dt seconds.
   * @param {number} elapsed - total elapsed time in seconds
   * @param {number} dt - delta time in seconds
   */
  step(elapsed: number, dt: number): void { throw new Error('not implemented') }

  /**
   * Get the current world-space transform of a body.
   * @param {string} id
   * @returns {{ position: {x,y,z}, rotation: {x,y,z,w} }}
   */
  getTransform(id: string): Transform | null { throw new Error('not implemented') }

  /**
   * Apply a force to a body (rigid body only).
   * @param {string} id
   * @param {{ x: number, y: number, z: number }} force
   */
  applyForce(id: string, force: Vector): void {}

  /**
   * Register a collision callback (rigid body only).
   * @param {(a: string, b: string) => void} callback
   */
  onCollision(callback: CollisionCallback): void {}

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

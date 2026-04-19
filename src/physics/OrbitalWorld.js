import { IPhysicsWorld } from './IPhysicsWorld.js'
import { AU_SCALE, TIME_YEAR_SECS } from '../utils/constants.js'
import { keplerPosition, degToRad } from '../utils/MathUtils.js'

/**
 * IPhysicsWorld implementation for Keplerian orbital mechanics.
 * Self-contained: does not depend on the legacy OrbitalMechanics class.
 */
export class OrbitalWorld extends IPhysicsWorld {
  constructor() {
    super()
    this._bodies = new Map()   // id → { desc, position: {x,y,z} }
    this._TWO_PI = Math.PI * 2
  }

  /**
   * Add an orbital body.
   * @param {string} id
   * @param {OrbitalBodyDesc} desc - must have type === 'orbital'
   */
  addBody(id, desc) {
    if (desc.type !== 'orbital') {
      throw new Error(`OrbitalWorld.addBody: expected type 'orbital', got '${desc.type}'`)
    }
    this._bodies.set(id, {
      desc,
      position: { x: 0, y: 0, z: 0 },
    })
  }

  removeBody(id) {
    this._bodies.delete(id)
  }

  /**
   * Step all orbital bodies forward to the given elapsed time.
   * @param {number} elapsed - total elapsed time in seconds
   * @param {number} dt - unused for orbital mechanics (position is deterministic from elapsed)
   */
  step(elapsed, dt) {
    for (const [id, body] of this._bodies) {
      const { desc } = body
      // Mean motion: radians per second
      const n = this._TWO_PI / (desc.period * TIME_YEAR_SECS)
      // Mean anomaly at this elapsed time
      const M = n * elapsed

      const { x, z } = keplerPosition(desc.semiMajorAxis, desc.eccentricity, M, AU_SCALE)

      // Apply orbital inclination (tilt around X axis, matching legacy OrbitalMechanics)
      const inc = degToRad(desc.inclination)
      body.position = {
        x,
        y: Math.sin(inc) * z,
        z: Math.cos(inc) * z,
      }
    }
  }

  /**
   * @param {string} id
   * @returns {{ position: {x,y,z}, rotation: {x,y,z,w} } | null}
   */
  getTransform(id) {
    const body = this._bodies.get(id)
    if (!body) return null
    return { position: body.position, rotation: { x: 0, y: 0, z: 0, w: 1 } }
  }

  dispose() {
    this._bodies.clear()
  }
}

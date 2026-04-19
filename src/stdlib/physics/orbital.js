/**
 * artlab/physics/orbital
 *
 * DSL-friendly wrappers around Keplerian orbital mechanics.
 * Delegates the heavy math to keplerPosition / solveKepler in MathUtils.
 *
 * @module artlab/physics/orbital
 *
 * @example
 *   import { orbit, attachOrbit, solarOrbit, AU } from 'artlab/physics/orbital'
 *
 *   // Custom orbit
 *   const o = orbit({ semiMajorAxis: 1.5, eccentricity: 0.1, period: 1.84 })
 *   const pos = o.position(elapsedSeconds)   // → THREE.Vector3
 *
 *   // Attach to a scene object — returns an updater function
 *   const update = attachOrbit(myMesh, { semiMajorAxis: 1.5, eccentricity: 0.1, period: 1.84 })
 *   // in render loop: update(elapsed)
 *
 *   // Named solar-system planet
 *   const earthOrbit = solarOrbit('earth')
 */

import { keplerPosition, degToRad } from '../../utils/MathUtils.js'
import { AU_SCALE, TIME_YEAR_SECS } from '../../utils/constants.js'

// Re-export planet data so DSL programs can read it without a separate import
export { PLANET_DATA, PLANET_ORDER } from './planetData.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 1 AU in scene units (matches AU_SCALE in constants.js) */
export const AU = AU_SCALE   // 100

/** Normalized solar mass (dimensionless; used as a convenient reference) */
export const SOLAR_MASS = 1

// ---------------------------------------------------------------------------
// Orbit descriptor
// ---------------------------------------------------------------------------

/**
 * Create a Kepler orbit descriptor.
 *
 * @param {object} params
 * @param {number}  params.semiMajorAxis  Semi-major axis in AU
 * @param {number}  [params.eccentricity] Orbital eccentricity (default 0)
 * @param {number}  [params.inclination]  Inclination in degrees (default 0)
 * @param {number}  [params.period]       Orbital period in Earth years (default 1)
 * @param {number}  [params.phase]        Initial mean anomaly offset in radians (default 0)
 * @returns {{ position(elapsed: number): {x: number, y: number, z: number}, params: object }}
 *
 * @example
 *   const o = orbit({ semiMajorAxis: 1, eccentricity: 0.017 })
 *   const { x, y, z } = o.position(elapsed)
 */
export function orbit(params) {
  const {
    semiMajorAxis,
    eccentricity = 0,
    inclination  = 0,
    period       = 1,
    phase        = 0,
  } = params

  const TWO_PI   = Math.PI * 2
  const incRad   = degToRad(inclination)
  // Mean motion: radians per second (matches OrbitalMechanics.js convention)
  const n        = TWO_PI / (period * TIME_YEAR_SECS)

  return {
    /** Original parameters, for inspection. */
    params: { semiMajorAxis, eccentricity, inclination, period, phase },

    /**
     * Compute the orbital position at `elapsed` seconds since epoch.
     *
     * Returns a plain { x, y, z } object in scene units so the caller does
     * not depend on THREE being available at import time.  If the caller
     * holds a THREE.Vector3 they can use `.set(x, y, z)` directly.
     *
     * @param {number} elapsed  Seconds since simulation start
     * @returns {{ x: number, y: number, z: number }}
     */
    position(elapsed) {
      const M = n * elapsed + phase  // mean anomaly
      const { x, z } = keplerPosition(semiMajorAxis, eccentricity, M, AU_SCALE)
      // Apply inclination: tilt around X axis, same convention as OrbitalMechanics.js
      return {
        x,
        y: Math.sin(incRad) * z,
        z: Math.cos(incRad) * z,
      }
    },
  }
}

// ---------------------------------------------------------------------------
// attachOrbit
// ---------------------------------------------------------------------------

/**
 * Animate an object on a Keplerian orbit by updating its `.position` each frame.
 *
 * The returned function accepts elapsed seconds and writes directly to
 * `obj.position.x/y/z`, making it compatible with THREE.Object3D.
 *
 * @param {object} obj          Any object with a numeric `.position.{x,y,z}`
 * @param {object} orbitParams  Same params accepted by `orbit()`
 * @returns {function(elapsed: number): void}  Call once per frame
 *
 * @example
 *   const update = attachOrbit(mesh, { semiMajorAxis: 1, eccentricity: 0.017, period: 1 })
 *   // in animation loop:
 *   update(elapsed)
 */
export function attachOrbit(obj, orbitParams) {
  const descriptor = orbit(orbitParams)
  return function update(elapsed) {
    const pos = descriptor.position(elapsed)
    obj.position.x = pos.x
    obj.position.y = pos.y
    obj.position.z = pos.z
  }
}

// ---------------------------------------------------------------------------
// solarOrbit
// ---------------------------------------------------------------------------

/**
 * Return an orbit descriptor pre-configured for a named solar-system planet.
 *
 * Planet names are lower-case: 'mercury', 'venus', 'earth', 'mars',
 * 'jupiter', 'saturn', 'uranus', 'neptune'.
 *
 * @param {string} planetName
 * @returns {{ position(elapsed: number): {x: number, y: number, z: number}, params: object }}
 * @throws {Error} if the planet name is not found in PLANET_DATA
 *
 * @example
 *   const earthOrbit = solarOrbit('earth')
 *   mesh.position.set(...Object.values(earthOrbit.position(elapsed)))
 */
export function solarOrbit(planetName) {
  // Lazy-import to avoid circular reference at module parse time
  // (PLANET_DATA itself imports from constants.js which we also import above).
  // A dynamic import is unnecessary here because we are just reading a re-exported
  // value; the static import is resolved before the function is called.
  const key = planetName.toLowerCase()

  // We need to access PLANET_DATA at call-time rather than module-load-time
  // so that consumers who tree-shake planetData.js don't break the import chain.
  // Use a dynamic require-style trick via module-level lazy holder.
  if (!_planetDataCache) {
    throw new Error(
      '[artlab/physics/orbital] solarOrbit() called before PLANET_DATA was loaded. ' +
      'Import PLANET_DATA explicitly or call solarOrbit() after module initialisation.'
    )
  }

  const data = _planetDataCache[key]
  if (!data) {
    throw new Error(`[artlab/physics/orbital] Unknown planet: "${planetName}". ` +
      `Valid names: ${Object.keys(_planetDataCache).join(', ')}`)
  }

  return orbit({
    semiMajorAxis: data.semiMajorAxis,
    eccentricity:  data.eccentricity,
    inclination:   data.inclination,
    period:        data.orbitalPeriod,
  })
}

// ---------------------------------------------------------------------------
// Internal: populate the planet-data cache synchronously at module load.
// The static import at the top of the file ensures this runs before any
// consumer calls solarOrbit().
// ---------------------------------------------------------------------------

import { PLANET_DATA as _PD } from './planetData.js'
let _planetDataCache = _PD

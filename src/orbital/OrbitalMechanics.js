import { keplerPosition, degToRad } from '../utils/MathUtils.js'
import { AU_SCALE, TIME_YEAR_SECS, PLANET_SCALE } from '../utils/constants.js'
import { PLANET_DATA, MOON_DATA } from './planetData.js'

export class OrbitalMechanics {
  /**
   * @param {Object} planetObjects  - map of name → { group/lod, data }
   * @param {Object} sunObject      - Sun instance (for position reference)
   * @param {Object|null} moonObject - Moon orbit group (optional)
   */
  constructor(planetObjects, sunObject, moonObject = null) {
    this.planets = planetObjects
    this.sun = sunObject
    this.moon = moonObject
    this.TWO_PI = Math.PI * 2
  }

  /**
   * @param {number} elapsed - seconds since start
   */
  update(elapsed) {
    for (const [name, planet] of Object.entries(this.planets)) {
      const data = PLANET_DATA[name]
      if (!data) continue

      // Mean motion: radians per second
      const n = this.TWO_PI / (data.orbitalPeriod * TIME_YEAR_SECS)
      const M = n * elapsed  // mean anomaly

      const { x, z } = keplerPosition(data.semiMajorAxis, data.eccentricity, M, AU_SCALE)

      // Apply orbital inclination (tilt around X axis)
      const inc = degToRad(data.inclination)
      planet.mesh.position.set(x, Math.sin(inc) * z, Math.cos(inc) * z)
      // Self-rotation is handled by each planet class's update() method
    }

    // Moon orbits Earth
    // The Moon is ~60 Earth radii away. In scene units: 60 × PLANET_SCALE = 150 units.
    if (this.moon && this.planets.earth) {
      const earthPos = this.planets.earth.mesh.position
      const moonN = this.TWO_PI / (MOON_DATA.orbitalPeriod * TIME_YEAR_SECS)
      const moonM = moonN * elapsed
      const moonR = 60 * PLANET_SCALE  // 60 Earth radii in scene space

      this.moon.position.set(
        earthPos.x + moonR * Math.cos(moonM),
        earthPos.y + moonR * Math.sin(moonM) * 0.08,
        earthPos.z + moonR * Math.sin(moonM)
      )
    }
  }

  /** Get current position of a planet by name (Three.js Vector3) */
  getPosition(name) {
    return this.planets[name]?.mesh?.position ?? null
  }
}

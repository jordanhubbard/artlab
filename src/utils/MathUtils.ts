/**
 * Solve Kepler's equation M = E - e*sin(E) for eccentric anomaly E
 * using Newton-Raphson iteration
 */
export function solveKepler(M: number, e: number, iterations = 6) {
  let E = M
  for (let i = 0; i < iterations; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
  }
  return E
}

/**
 * Get orbital position { x, z } from Keplerian elements
 * @param {number} semiMajorAxis - in AU
 * @param {number} eccentricity
 * @param {number} meanAnomaly - in radians
 * @param {number} auScale - units per AU
 */
export function keplerPosition(semiMajorAxis: number, eccentricity: number, meanAnomaly: number, auScale: number) {
  const E = solveKepler(meanAnomaly, eccentricity)
  const cosE = Math.cos(E)
  const sinE = Math.sin(E)
  const r = semiMajorAxis * (1 - eccentricity * cosE)
  const trueAnomaly = Math.atan2(
    Math.sqrt(1 - eccentricity * eccentricity) * sinE,
    cosE - eccentricity
  )
  return {
    x: r * Math.cos(trueAnomaly) * auScale,
    z: r * Math.sin(trueAnomaly) * auScale,
  }
}

/** Simple hash function for reproducible per-star randomness */
export function hash(n: number) {
  return (Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** Clamp value between min and max */
export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

/** Convert degrees to radians */
export function degToRad(deg: number) {
  return deg * (Math.PI / 180)
}

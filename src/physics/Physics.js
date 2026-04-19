/**
 * Artlab Physics — textbook-quality physics primitives for creative coding.
 *
 * Design principles:
 *  - Pure functions wherever possible; no hidden mutable state.
 *  - Bodies are plain objects: { position, velocity, force, mass }.
 *  - Forces are computed and returned as Vector3; the caller accumulates them.
 *  - Integration is explicit — call integrate() once per frame after accumulating forces.
 *  - G, g, and other physical constants have realistic SI defaults but can be
 *    overridden freely for artistic / scaled-world use.
 *
 * Sections
 *  1. Body factory
 *  2. Force accumulation
 *  3. Force functions  (pure → Vector3)
 *  4. Integration
 *  5. Orbital mechanics
 *  6. Collision
 *  7. Energy & momentum
 *  8. Fields
 */

import * as Three from 'three'

// ── Physical constants (SI) ────────────────────────────────────────────────────

export const G_SI   = 6.674e-11   // gravitational constant  N·m²/kg²
export const G_NORM = 1.0         // convenient scaled G for creative use
export const g_SI   = 9.80665     // standard gravity  m/s²

// ─────────────────────────────────────────────────────────────────────────────
// 1. Body factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a physics body — the fundamental simulated object.
 *
 * @param {object} opts
 * @param {Three.Vector3} [opts.position]
 * @param {Three.Vector3} [opts.velocity]
 * @param {number}        [opts.mass=1]
 * @param {number}        [opts.charge=0]   — electric charge, used by lorentzForce
 * @param {number}        [opts.restitution=1]  — bounciness 0..1
 * @returns {{ position, velocity, force, mass, charge, restitution }}
 */
export function body({
  position    = new Three.Vector3(),
  velocity    = new Three.Vector3(),
  mass        = 1,
  charge      = 0,
  restitution = 1,
} = {}) {
  return {
    position:    position.clone(),
    velocity:    velocity.clone(),
    force:       new Three.Vector3(),
    mass,
    charge,
    restitution,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Force accumulation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a force vector to a body's accumulator.
 * Call this once per force source per frame, then call integrate().
 * @param {{ force: Three.Vector3 }} body
 * @param {Three.Vector3} force
 */
export function applyForce(body, force) {
  body.force.add(force)
}

/**
 * Apply an instantaneous impulse directly to velocity (bypasses mass for raw kicks).
 * Impulse = change in momentum = mass × Δvelocity, so Δv = impulse / mass.
 * @param {{ velocity: Three.Vector3, mass: number }} body
 * @param {Three.Vector3} impulse
 */
export function applyImpulse(body, impulse) {
  body.velocity.addScaledVector(impulse, 1 / body.mass)
}

/**
 * Zero a body's force accumulator.
 * integrate() does this automatically; only call manually if needed mid-frame.
 * @param {{ force: Three.Vector3 }} body
 */
export function clearForces(body) {
  body.force.set(0, 0, 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Force functions  (pure — return new Vector3, never mutate inputs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uniform gravitational acceleration field.
 * F = m * g  (downward in Y).
 *
 * @param {number} mass
 * @param {number} [g=9.80665]  — acceleration magnitude, m/s²
 * @returns {Three.Vector3}
 */
export function gravityForce(mass, g = g_SI) {
  return new Three.Vector3(0, -mass * g, 0)
}

/**
 * Newton's law of universal gravitation between two point masses.
 * F = G · m₁ · m₂ / r²  directed from posA toward posB.
 *
 * Returns the force on body A; negate for force on body B.
 *
 * @param {Three.Vector3} posA
 * @param {number}        massA
 * @param {Three.Vector3} posB
 * @param {number}        massB
 * @param {number}        [G=G_SI]
 * @returns {Three.Vector3}
 */
export function gravitationForce(posA, massA, posB, massB, G = G_SI) {
  const r    = new Three.Vector3().subVectors(posB, posA)
  const dist = r.length()
  if (dist < 1e-10) return new Three.Vector3()
  const magnitude = G * massA * massB / (dist * dist)
  return r.normalize().multiplyScalar(magnitude)
}

/**
 * Linear (Stokes) drag: F = −k · v.
 * Models viscous resistance at low Reynolds numbers.
 *
 * @param {Three.Vector3} velocity
 * @param {number}        coefficient  k ≥ 0
 * @returns {Three.Vector3}
 */
export function dragForce(velocity, coefficient) {
  return velocity.clone().multiplyScalar(-coefficient)
}

/**
 * Quadratic (Newton) drag: F = −k · |v| · v.
 * More realistic for high-speed motion through air.
 *
 * @param {Three.Vector3} velocity
 * @param {number}        coefficient  k ≥ 0
 * @returns {Three.Vector3}
 */
export function quadraticDragForce(velocity, coefficient) {
  const speed = velocity.length()
  return velocity.clone().multiplyScalar(-coefficient * speed)
}

/**
 * Hooke's law spring with optional velocity damping.
 * F_spring = k · (|r| − L₀) · r̂
 * F_damp   = c · (v_rel · r̂) · r̂
 *
 * Returns the force that acts on body A (toward B when stretched).
 *
 * @param {Three.Vector3} posA
 * @param {Three.Vector3} posB
 * @param {number}        restLength   L₀
 * @param {number}        stiffness    k
 * @param {Three.Vector3} [velA]       required if damping > 0
 * @param {Three.Vector3} [velB]       required if damping > 0
 * @param {number}        [damping=0]  c — damping coefficient
 * @returns {Three.Vector3}
 */
export function springForce(posA, posB, restLength, stiffness, velA, velB, damping = 0) {
  const r    = new Three.Vector3().subVectors(posB, posA)
  const dist = r.length()
  if (dist < 1e-10) return new Three.Vector3()
  const dir    = r.clone().normalize()
  const spring = dir.clone().multiplyScalar(stiffness * (dist - restLength))
  if (damping > 0 && velA && velB) {
    const relVel = new Three.Vector3().subVectors(velB, velA)
    const damp   = dir.clone().multiplyScalar(damping * relVel.dot(dir))
    spring.add(damp)
  }
  return spring
}

/**
 * Lorentz force on a charged particle: F = q · (E + v × B).
 *
 * @param {number}        charge    q
 * @param {Three.Vector3} velocity  v
 * @param {Three.Vector3} electricField   E
 * @param {Three.Vector3} magneticField   B
 * @returns {Three.Vector3}
 */
export function lorentzForce(charge, velocity, electricField, magneticField) {
  const vCrossB = new Three.Vector3().crossVectors(velocity, magneticField)
  return new Three.Vector3()
    .addVectors(electricField, vCrossB)
    .multiplyScalar(charge)
}

/**
 * Buoyancy force (Archimedes' principle): F = ρ_fluid · V_submerged · g (upward).
 *
 * @param {number} fluidDensity    ρ, kg/m³
 * @param {number} volumeSubmerged V, m³
 * @param {number} [g=9.80665]
 * @returns {Three.Vector3}
 */
export function buoyancyForce(fluidDensity, volumeSubmerged, g = g_SI) {
  return new Three.Vector3(0, fluidDensity * volumeSubmerged * g, 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Integration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Symplectic (semi-implicit) Euler integration.
 * Updates velocity first, then position — better energy conservation than
 * explicit Euler for oscillatory systems (springs, orbits).
 *
 * Clears the force accumulator after stepping.
 *
 * @param {{ position, velocity, force, mass }} body
 * @param {number} dt  seconds
 */
export function integrate(body, dt) {
  const acc = body.force.clone().divideScalar(body.mass)
  body.velocity.addScaledVector(acc, dt)
  body.position.addScaledVector(body.velocity, dt)
  body.force.set(0, 0, 0)
}

/**
 * Velocity Verlet integration.
 * Uses the average of the previous and current acceleration, giving
 * second-order accuracy — preferred for conservative forces (gravity, orbital).
 *
 * @param {{ position, velocity, force, mass }} body
 * @param {Three.Vector3} prevForce  — force from the *previous* frame
 * @param {number}        dt
 * @returns {Three.Vector3}  current force (pass as prevForce next frame)
 */
export function integrateVerlet(body, prevForce, dt) {
  const acc     = body.force.clone().divideScalar(body.mass)
  const prevAcc = prevForce.clone().divideScalar(body.mass)
  // x(t+dt) = x(t) + v(t)*dt + ½*a(t)*dt²
  body.position
    .addScaledVector(body.velocity, dt)
    .addScaledVector(acc, 0.5 * dt * dt)
  // v(t+dt) = v(t) + ½*(a(t) + a(t+dt))*dt
  body.velocity.addScaledVector(acc.add(prevAcc), 0.5 * dt)
  const current = body.force.clone()
  body.force.set(0, 0, 0)
  return current
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Orbital mechanics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Circular orbital speed: v = √(G·M / r).
 * The tangential velocity needed to maintain a circular orbit at radius r
 * around a central body of mass M.
 *
 * @param {number} centralMass  M, kg
 * @param {number} radius       r, m
 * @param {number} [G=G_SI]
 * @returns {number}  speed in m/s
 */
export function orbitalSpeed(centralMass, radius, G = G_SI) {
  return Math.sqrt(G * centralMass / radius)
}

/**
 * Orbital period by Kepler's third law: T = 2π · √(a³ / (G·M)).
 *
 * @param {number} semiMajorAxis  a, m
 * @param {number} centralMass    M, kg
 * @param {number} [G=G_SI]
 * @returns {number}  period in seconds
 */
export function orbitalPeriod(semiMajorAxis, centralMass, G = G_SI) {
  return 2 * Math.PI * Math.sqrt(semiMajorAxis ** 3 / (G * centralMass))
}

/**
 * Escape speed: v_e = √(2·G·M / r).
 * Minimum speed needed to escape a gravitational well from radius r.
 *
 * @param {number} centralMass  M, kg
 * @param {number} radius       r, m
 * @param {number} [G=G_SI]
 * @returns {number}
 */
export function escapeSpeed(centralMass, radius, G = G_SI) {
  return Math.sqrt(2 * G * centralMass / radius)
}

/**
 * Mean anomaly at time t: M = 2π · t / T  (mod 2π).
 *
 * @param {number} t       elapsed time, s
 * @param {number} period  orbital period T, s
 * @returns {number}  mean anomaly in radians [0, 2π)
 */
export function meanAnomaly(t, period) {
  return ((2 * Math.PI * t) / period) % (2 * Math.PI)
}

/**
 * Solve Kepler's equation M = E − e·sin(E) for eccentric anomaly E.
 * Uses Newton–Raphson iteration; converges in < 10 steps for e < 0.9.
 *
 * @param {number} M          mean anomaly, rad
 * @param {number} e          eccentricity [0, 1)
 * @param {number} [tol=1e-8] convergence tolerance
 * @returns {number}  eccentric anomaly E, rad
 */
export function solveKepler(M, e, tol = 1e-8) {
  let E = M  // initial guess (good for low e)
  for (let i = 0; i < 50; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E))
    E += dE
    if (Math.abs(dE) < tol) break
  }
  return E
}

/**
 * Position on a Keplerian orbit from the mean anomaly.
 * Returns the x and z coordinates in the orbital plane (y=0 at inclination 0).
 * The focus (central body) is at the origin.
 *
 * @param {number} semiMajorAxis   a
 * @param {number} eccentricity    e  [0, 1)
 * @param {number} meanAnomalyRad  M  (use meanAnomaly() to compute from time)
 * @returns {{ x: number, z: number }}
 */
export function keplerPosition(semiMajorAxis, eccentricity, meanAnomalyRad) {
  const E = solveKepler(meanAnomalyRad, eccentricity)
  const b = semiMajorAxis * Math.sqrt(1 - eccentricity ** 2)  // semi-minor axis
  // Perifocal coordinates: focus at origin, periapsis along +x
  const x = semiMajorAxis * (Math.cos(E) - eccentricity)
  const z = b * Math.sin(E)
  return { x, z }
}

/**
 * Vis-viva equation: orbital speed at a given distance r from focus.
 * v² = G·M · (2/r − 1/a)
 *
 * Works for any point on an elliptical orbit; reduces to orbitalSpeed() at r=a
 * for a circular orbit (e=0).
 *
 * @param {number} centralMass   M
 * @param {number} r             current distance from focus
 * @param {number} semiMajorAxis a
 * @param {number} [G=G_SI]
 * @returns {number}  speed
 */
export function visViva(centralMass, r, semiMajorAxis, G = G_SI) {
  return Math.sqrt(G * centralMass * (2 / r - 1 / semiMajorAxis))
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Collision
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sphere–sphere overlap test.
 * @param {Three.Vector3} posA
 * @param {number}        radiusA
 * @param {Three.Vector3} posB
 * @param {number}        radiusB
 * @returns {number}  penetration depth ≥ 0 (0 = touching or separated)
 */
export function sphereOverlap(posA, radiusA, posB, radiusB) {
  return Math.max(0, radiusA + radiusB - posA.distanceTo(posB))
}

/**
 * Resolve a collision between two spherical bodies using the impulse method.
 * Handles both elastic (restitution=1) and inelastic (0 ≤ restitution < 1) cases.
 * Mutates bodyA.velocity and bodyB.velocity.
 *
 * @param {{ position, velocity, mass, restitution }} bodyA
 * @param {{ position, velocity, mass, restitution }} bodyB
 * @param {number} [restitution]  override; defaults to min(bodyA.restitution, bodyB.restitution)
 */
export function resolveCollision(bodyA, bodyB, restitution) {
  const e  = restitution ?? Math.min(bodyA.restitution, bodyB.restitution)
  const n  = new Three.Vector3().subVectors(bodyB.position, bodyA.position).normalize()
  const vr = new Three.Vector3().subVectors(bodyA.velocity, bodyB.velocity)
  const vn = vr.dot(n)
  if (vn <= 0) return  // already separating — no impulse needed
  const j = (1 + e) * vn / (1 / bodyA.mass + 1 / bodyB.mass)
  bodyA.velocity.addScaledVector(n, -j / bodyA.mass)
  bodyB.velocity.addScaledVector(n,  j / bodyB.mass)
}

/**
 * Separate two overlapping spheres by moving them apart along their connecting axis.
 * Distributes displacement proportionally to inverse mass (lighter body moves more).
 * Mutates bodyA.position and bodyB.position.
 *
 * @param {{ position, mass }} bodyA
 * @param {number}             radiusA
 * @param {{ position, mass }} bodyB
 * @param {number}             radiusB
 */
export function separateSpheres(bodyA, radiusA, bodyB, radiusB) {
  const depth = sphereOverlap(bodyA.position, radiusA, bodyB.position, radiusB)
  if (depth <= 0) return
  const n        = new Three.Vector3().subVectors(bodyB.position, bodyA.position).normalize()
  const totalInv = 1 / bodyA.mass + 1 / bodyB.mass
  bodyA.position.addScaledVector(n, -depth * (1 / bodyA.mass) / totalInv)
  bodyB.position.addScaledVector(n,  depth * (1 / bodyB.mass) / totalInv)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Energy & momentum
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translational kinetic energy: KE = ½ · m · v².
 * @param {{ velocity: Three.Vector3, mass: number }} body
 * @returns {number}
 */
export function kineticEnergy(body) {
  return 0.5 * body.mass * body.velocity.lengthSq()
}

/**
 * Gravitational potential energy: U = −G · M · m / r.
 * @param {number} centralMass  M
 * @param {number} bodyMass     m
 * @param {number} distance     r
 * @param {number} [G=G_SI]
 * @returns {number}
 */
export function gravitationalPotentialEnergy(centralMass, bodyMass, distance, G = G_SI) {
  return -G * centralMass * bodyMass / distance
}

/**
 * Spring (elastic) potential energy: U = ½ · k · x².
 * @param {number} stiffness  k
 * @param {number} extension  x = current length − rest length
 * @returns {number}
 */
export function springPotentialEnergy(stiffness, extension) {
  return 0.5 * stiffness * extension * extension
}

/**
 * Linear momentum: p = m · v.
 * @param {{ velocity: Three.Vector3, mass: number }} body
 * @returns {Three.Vector3}
 */
export function momentum(body) {
  return body.velocity.clone().multiplyScalar(body.mass)
}

/**
 * Angular momentum about the origin: L = r × p.
 * @param {Three.Vector3} position
 * @param {{ velocity: Three.Vector3, mass: number }} body
 * @returns {Three.Vector3}
 */
export function angularMomentum(position, body) {
  return new Three.Vector3()
    .crossVectors(position, momentum(body))
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Fields
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uniform force field — same force everywhere (e.g. gravity near Earth's surface,
 * uniform wind).
 *
 * @param {Three.Vector3} direction  need not be normalized
 * @param {number}        magnitude
 * @returns {Three.Vector3}
 */
export function uniformField(direction, magnitude) {
  return direction.clone().normalize().multiplyScalar(magnitude)
}

/**
 * Radial inverse-square field centered at a point.
 * magnitude > 0 → attractor (pulls inward), magnitude < 0 → repulsor.
 * F = magnitude / r²  directed toward/away from center.
 *
 * @param {Three.Vector3} center
 * @param {Three.Vector3} position  where the field is evaluated
 * @param {number}        magnitude
 * @returns {Three.Vector3}
 */
export function radialField(center, position, magnitude) {
  const r    = new Three.Vector3().subVectors(center, position)
  const dist = r.length()
  if (dist < 1e-10) return new Three.Vector3()
  return r.normalize().multiplyScalar(magnitude / (dist * dist))
}

/**
 * Vortex field — tangential force circling an axis.
 * Induces rotation around the given axis through center.
 *
 * @param {Three.Vector3} center
 * @param {Three.Vector3} axis       rotation axis (normalized)
 * @param {Three.Vector3} position
 * @param {number}        magnitude
 * @returns {Three.Vector3}
 */
export function vortexField(center, axis, position, magnitude) {
  const r   = new Three.Vector3().subVectors(position, center)
  const tan = new Three.Vector3().crossVectors(axis, r)
  if (tan.lengthSq() < 1e-20) return new Three.Vector3()
  return tan.normalize().multiplyScalar(magnitude)
}

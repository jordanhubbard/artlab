// Camera Journey — a dramatic central object always kept in frame as the camera
// orbits at varying radius and height. Press C to toggle manual OrbitControls.

// Irrational frequency ratios keep motion non-repetitive.
const F1 = 1.0
const F2 = Math.PI / 3        // ≈ 1.047
const F3 = Math.sqrt(2) / 2   // ≈ 0.707
const F4 = Math.sqrt(3) / 4   // ≈ 0.433

const RING_DATA = [
  { color: 0xff3366, radius: 1.8, tube: 0.08, tiltX:  0.0,          tiltZ: 0.0, speed:  0.5  },
  { color: 0x33ccff, radius: 2.2, tube: 0.07, tiltX:  Math.PI / 3,  tiltZ: 0.2, speed: -0.37 },
  { color: 0x88ff44, radius: 1.5, tube: 0.09, tiltX: -Math.PI / 5,  tiltZ: Math.PI / 2, speed:  0.61 },
]

const ORBITER_DATA = [
  { color: 0xff8800, emissive: 0x441100, radius: 0.14, orbitR: 2.8, orbitTilt:  0.3, speed:  1.3,  phase: 0.00 },
  { color: 0xaa44ff, emissive: 0x220033, radius: 0.12, orbitR: 3.4, orbitTilt: -0.5, speed:  0.9,  phase: 1.05 },
  { color: 0x00ffcc, emissive: 0x003322, radius: 0.10, orbitR: 2.2, orbitTilt:  0.7, speed:  1.7,  phase: 2.09 },
  { color: 0xff44cc, emissive: 0x330011, radius: 0.13, orbitR: 3.0, orbitTilt: -0.2, speed: -1.1,  phase: 3.14 },
  { color: 0xffee00, emissive: 0x332200, radius: 0.11, orbitR: 2.6, orbitTilt:  1.0, speed:  0.7,  phase: 4.19 },
  { color: 0x4488ff, emissive: 0x001133, radius: 0.09, orbitR: 3.7, orbitTilt: -0.8, speed: -0.55, phase: 5.24 },
  { color: 0xff6644, emissive: 0x331100, radius: 0.15, orbitR: 2.4, orbitTilt:  0.4, speed:  1.5,  phase: 0.52 },
  { color: 0xccff44, emissive: 0x223300, radius: 0.10, orbitR: 3.2, orbitTilt: -0.6, speed: -0.8,  phase: 2.62 },
]

export function setup(ctx) {
  const { Three, sphere, torus, mesh, ambient, point } = ctx

  ctx.setBloom(1.0)
  ctx.controls.enabled = false

  // Lighting
  ctx.add(ambient(0x0a0a1a, 1.0))

  const light1 = point(0xff6633, 4.0, 20, 2)
  light1.position.set(5, 5, 5)
  ctx.add(light1)

  const light2 = point(0x3366ff, 3.0, 20, 2)
  light2.position.set(-5, -3, -5)
  ctx.add(light2)

  // Core sphere — large glowing emissive
  const coreMesh = mesh(sphere(1.2, 48), { color: 0xffffff, roughness: 0.15, metalness: 0.2 })
  coreMesh.material.emissive = new Three.Color(0xffffff)
  coreMesh.material.emissiveIntensity = 0.9
  ctx.add(coreMesh)
  ctx._core = coreMesh

  // Point light at center to illuminate rings/orbiters
  const coreLight = point(0xffeedd, 2.5, 15, 2)
  coreLight.position.set(0, 0, 0)
  ctx.add(coreLight)

  // Torus rings
  ctx._rings = []
  for (const rd of RING_DATA) {
    const ringMesh = mesh(torus(rd.radius, rd.tube, 16, 80), { color: rd.color, roughness: 0.3, metalness: 0.5 })
    ringMesh.material.emissive = new Three.Color(rd.color)
    ringMesh.material.emissiveIntensity = 0.7
    ringMesh.rotation.x = rd.tiltX
    ringMesh.rotation.z = rd.tiltZ
    ctx.add(ringMesh)
    ctx._rings.push({ mesh: ringMesh, speed: rd.speed, tiltX: rd.tiltX, tiltZ: rd.tiltZ })
  }

  // Small orbiting spheres
  ctx._orbiters = []
  for (const od of ORBITER_DATA) {
    const orbMesh = mesh(sphere(od.radius, 12), { color: od.color, roughness: 0.4, metalness: 0.6 })
    orbMesh.material.emissive = new Three.Color(od.emissive)
    orbMesh.material.emissiveIntensity = 0.5
    ctx.add(orbMesh)
    ctx._orbiters.push({ mesh: orbMesh, ...od })
  }

  // Initial camera position
  ctx.camera.position.set(8, 3, 0)
  ctx.camera.lookAt(0, 0, 0)
  ctx._useOrbit = false

  // Keypress handler — C toggles manual OrbitControls
  ctx._onKey = (e) => {
    if (e.key === 'c' || e.key === 'C') {
      ctx._useOrbit = !ctx._useOrbit
      ctx.controls.enabled = ctx._useOrbit
    }
  }
  window.addEventListener('keydown', ctx._onKey)
}

export function update(ctx, dt) {
  const t = ctx.elapsed

  // Pulse core glow
  ctx._core.material.emissiveIntensity = 0.7 + 0.3 * Math.sin(t * F1 * 1.1)

  // Spin rings at their own speeds
  for (const ring of ctx._rings) {
    ring.mesh.rotation.x = ring.tiltX + t * ring.speed * 0.8
    ring.mesh.rotation.y = t * ring.speed
    ring.mesh.rotation.z = ring.tiltZ + t * ring.speed * 0.4
  }

  // Move orbiters
  for (const orb of ctx._orbiters) {
    const angle = t * orb.speed + orb.phase
    const px = orb.orbitR * Math.cos(angle)
    let   pz = orb.orbitR * Math.sin(angle)
    const py = pz * Math.sin(orb.orbitTilt)
    pz       = pz * Math.cos(orb.orbitTilt)
    orb.mesh.position.set(px, py, pz)
    // Pulse emissive slightly
    orb.mesh.material.emissiveIntensity = 0.3 + 0.3 * Math.sin(t * 1.3 + orb.phase)
  }

  // Auto-orbit camera — overlapping sin/cos with irrational ratios so it never repeats
  if (!ctx._useOrbit) {
    const baseR  = 8.5
    const r      = baseR + 1.5 * Math.sin(t * F3) + 0.5 * Math.cos(t * F4 * 1.7)
    const theta  = t * 0.23 + 0.4 * Math.sin(t * F2 * 0.6)  // horizontal angle
    const height = 3.0 + 2.0 * Math.sin(t * F4) + 0.8 * Math.cos(t * F2 * 0.8)

    ctx.camera.position.set(
      r * Math.cos(theta),
      height,
      r * Math.sin(theta)
    )
    ctx.camera.lookAt(0, 0, 0)
  }
}

export function teardown(ctx) {
  window.removeEventListener('keydown', ctx._onKey)
  ctx.controls.enabled = true
}

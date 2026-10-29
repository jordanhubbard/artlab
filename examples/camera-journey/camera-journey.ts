// Camera Journey — a visible spline-driven camera tour through a pillar field.
// Press C to toggle manual OrbitControls; press Space to rejoin the path.

const TOUR_SECONDS = 42
const LOOK_AHEAD = 0.045
const GRID_SIZE = 13
const GRID_SPACING = 1.35

const PATH_POINTS = [
  [-8.5, 2.2,  6.0],
  [-5.0, 5.0, -6.5],
  [ 0.8, 3.4, -9.0],
  [ 7.5, 6.2, -4.5],
  [ 9.0, 2.6,  3.8],
  [ 3.8, 4.8,  8.5],
  [-3.8, 3.0,  8.0],
]

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

function wrap01(t) {
  return ((t % 1) + 1) % 1
}

function pillarHeight(x, z) {
  const ridge = Math.sin(x * 0.7) * Math.cos(z * 0.55)
  const bowl = Math.exp(-0.035 * (x * x + z * z))
  return 0.35 + Math.max(0, ridge * 0.75 + bowl * 1.8)
}

function setHud(ctx, text) {
  if (ctx._journeyHud) ctx._journeyHud.textContent = text
}

function buildPillarField(ctx) {
  const { Three } = ctx
  const count = GRID_SIZE * GRID_SIZE
  const geo = new Three.BoxGeometry(0.42, 1, 0.42)
  const mat = new Three.MeshStandardMaterial({
    color: 0x24315d,
    emissive: new Three.Color(0x07132f),
    emissiveIntensity: 0.55,
    roughness: 0.62,
    metalness: 0.2,
  })
  const pillars = new Three.InstancedMesh(geo, mat, count)
  const dummy = new Three.Object3D()
  const offset = (GRID_SIZE - 1) * GRID_SPACING * 0.5
  let i = 0
  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const x = gx * GRID_SPACING - offset
      const z = gz * GRID_SPACING - offset
      const h = pillarHeight(x, z)
      dummy.position.set(x, -1.1 + h * 0.5, z)
      dummy.scale.set(1, h, 1)
      dummy.updateMatrix()
      pillars.setMatrixAt(i++, dummy.matrix)
    }
  }
  pillars.instanceMatrix.needsUpdate = true
  ctx.add(pillars)
  ctx._pillarField = pillars
}

function buildPathRail(ctx) {
  const { Three } = ctx
  const points = PATH_POINTS.map(p => new Three.Vector3(...p))
  const curve = new Three.CatmullRomCurve3(points, true, 'catmullrom', 0.28)
  const railPts = curve.getPoints(240)
  const rail = new Three.Line(
    new Three.BufferGeometry().setFromPoints(railPts),
    new Three.LineBasicMaterial({ color: 0x69d8ff, transparent: true, opacity: 0.58 })
  )
  ctx.add(rail)

  const markerGeo = new Three.SphereGeometry(0.12, 16, 8)
  const markerMat = new Three.MeshStandardMaterial({
    color: 0xfff0a0,
    emissive: new Three.Color(0xffaa44),
    emissiveIntensity: 0.8,
  })
  const markers = []
  for (const p of points) {
    const marker = new Three.Mesh(markerGeo, markerMat)
    marker.position.copy(p)
    ctx.add(marker)
    markers.push(marker)
  }

  ctx._cameraPath = curve
  ctx._pathRail = rail
  ctx._pathMarkers = markers
}

function updateCamera(ctx, t) {
  const u = wrap01(t / TOUR_SECONDS)
  const pos = ctx._cameraPath.getPointAt(u)
  const look = ctx._cameraPath.getPointAt(wrap01(u + LOOK_AHEAD))
  look.multiplyScalar(0.4)
  look.y = 0.45 + 0.25 * Math.sin(t * 0.45)

  ctx.camera.position.copy(pos)
  ctx.camera.lookAt(look)
  ctx.controls.target.copy(look)
  ctx._journeyLook.copy(look)
  ctx._pathProgress = u
}

function updateHud(ctx) {
  const progress = Math.round((ctx._pathProgress ?? 0) * 100)
  setHud(ctx, [
    'CAMERA JOURNEY',
    `MODE ${ctx._useOrbit ? 'MANUAL' : 'SCRIPTED'}`,
    `PATH ${String(progress).padStart(3, '0')}%`,
    'C TO TOGGLE',
    'SPACE TO REJOIN',
  ].join('\n'))
}

export function setup(ctx) {
  const { Three, sphere, torus, mesh, ambient, point } = ctx

  ctx.setHelp('C: toggle scripted/manual camera   •   Space: rejoin path')
  ctx.setBloom(0.72)
  ctx.controls.enabled = false
  ctx.controls.target.set(0, 0, 0)
  ctx.controls.minDistance = 2
  ctx.controls.maxDistance = 28

  ctx.add(ambient(0x111629, 0.7))

  const key = point(0xff6633, 4.0, 24, 2)
  key.position.set(5, 6, 5)
  ctx.add(key)

  const rim = point(0x3366ff, 3.4, 28, 2)
  rim.position.set(-6, 3, -6)
  ctx.add(rim)

  buildPillarField(ctx)
  buildPathRail(ctx)

  const coreMesh = mesh(sphere(1.05, 48), {
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.75,
    roughness: 0.15,
    metalness: 0.2,
  })
  ctx.add(coreMesh)
  ctx._core = coreMesh

  const coreLight = point(0xffeedd, 2.0, 16, 2)
  coreLight.position.set(0, 0, 0)
  ctx.add(coreLight)

  ctx._rings = []
  for (const rd of RING_DATA) {
    const ringMesh = mesh(torus(rd.radius, rd.tube, 16, 80), {
      color: rd.color,
      emissive: rd.color,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.5,
    })
    ringMesh.rotation.x = rd.tiltX
    ringMesh.rotation.z = rd.tiltZ
    ctx.add(ringMesh)
    ctx._rings.push({ mesh: ringMesh, speed: rd.speed, tiltX: rd.tiltX, tiltZ: rd.tiltZ })
  }

  ctx._orbiters = []
  for (const od of ORBITER_DATA) {
    const orbMesh = mesh(sphere(od.radius, 12), {
      color: od.color,
      emissive: od.emissive,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.6,
    })
    ctx.add(orbMesh)
    ctx._orbiters.push({ mesh: orbMesh, ...od })
  }

  const container = ctx.renderer.domElement.parentElement
  container.style.position = 'relative'
  const hud = document.createElement('div')
  hud.id = 'camera-journey-hud'
  hud.style.cssText =
    'position:absolute;top:14px;right:14px;pointer-events:none;z-index:10;' +
    'font-family:"Courier New",monospace;font-size:10px;line-height:1.7;' +
    'letter-spacing:0.14em;text-transform:uppercase;text-align:right;' +
    'white-space:pre;color:rgba(190,225,255,0.78);background:rgba(2,8,20,0.35);' +
    'border:1px solid rgba(110,170,255,0.16);padding:8px 10px;border-radius:2px'
  container.appendChild(hud)
  ctx._journeyHud = hud
  ctx._journeyLook = new Three.Vector3()
  ctx._useOrbit = false
  ctx._pathProgress = 0

  updateCamera(ctx, 0)
  updateHud(ctx)

  ctx._onKey = (e) => {
    if (e.key === 'c' || e.key === 'C') {
      ctx._useOrbit = !ctx._useOrbit
      ctx.controls.enabled = ctx._useOrbit
      ctx.controls.target.copy(ctx._journeyLook)
      ctx.controls.update?.()
      updateHud(ctx)
    } else if (e.key === ' ') {
      ctx._useOrbit = false
      ctx.controls.enabled = false
      updateCamera(ctx, ctx.elapsed)
      updateHud(ctx)
    }
  }
  window.addEventListener('keydown', ctx._onKey)
}

export function update(ctx, dt) {
  const t = ctx.elapsed

  ctx._core.material.emissiveIntensity = 0.6 + 0.32 * (0.5 + 0.5 * Math.sin(t * 1.1))

  for (const ring of ctx._rings) {
    ring.mesh.rotation.x = ring.tiltX + t * ring.speed * 0.8
    ring.mesh.rotation.y = t * ring.speed
    ring.mesh.rotation.z = ring.tiltZ + t * ring.speed * 0.4
  }

  for (const orb of ctx._orbiters) {
    const angle = t * orb.speed + orb.phase
    const px = orb.orbitR * Math.cos(angle)
    let pz = orb.orbitR * Math.sin(angle)
    const py = pz * Math.sin(orb.orbitTilt)
    pz = pz * Math.cos(orb.orbitTilt)
    orb.mesh.position.set(px, py, pz)
    orb.mesh.material.emissiveIntensity = 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.3 + orb.phase))
  }

  for (let i = 0; i < ctx._pathMarkers.length; i++) {
    const marker = ctx._pathMarkers[i]
    const pulse = 0.9 + 0.3 * Math.sin(t * 2.2 + i)
    marker.scale.setScalar(pulse)
  }

  if (!ctx._useOrbit) updateCamera(ctx, t)
  updateHud(ctx)
}

export function teardown(ctx) {
  window.removeEventListener('keydown', ctx._onKey)
  ctx._journeyHud?.remove()
  ctx.controls.enabled = true
}

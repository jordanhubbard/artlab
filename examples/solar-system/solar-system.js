// Solar System — audio-reactive 3D solar system, the Artlab reference package.
//
// Runs via StandaloneRunner (index.html) or the Artlab IDE.
// Imports camera-journey.js and audio.js from the same package directory.
//
// Scale: 1 AU = 100 Three.js units | Earth radius = 2.5 units | 1 year = 120 s

import { setupJourney, startJourney, updateJourney, journeyDone } from './camera-journey.js'
import { setupAudio, updateAudio, teardownAudio } from './audio.js'

// ── Constants ──────────────────────────────────────────────────────────────────
const AU   = 100          // 1 AU → Three.js units
const PS   = 2.5          // planet scale: Earth radius = PS units
const SUNR = 10           // sun visual radius
const YEAR = 120          // real seconds per simulated Earth year
const DAY  = YEAR / 365.25

const MOON_ORBIT_R = 8    // scaled-up moon orbit (0.00257 AU is sub-visual)

// ── Planet catalogue ───────────────────────────────────────────────────────────
const PLANETS = {
  mercury: { a: 0.387, T: 0.241,  r: 0.383,  tilt:   0.03, rot:   58.6,  color: 0x9e9e9e, tex: 'mercury/2k_mercury.jpg' },
  venus:   { a: 0.723, T: 0.615,  r: 0.949,  tilt: 177.4,  rot: -243,    color: 0xe8c870, tex: 'venus/2k_venus_atmosphere.jpg',   atm: [1.0, 0.85, 0.50] },
  earth:   { a: 1.000, T: 1.000,  r: 1.000,  tilt:  23.44, rot:    1.0,  color: 0x2255aa, tex: 'earth/2k_earth_daymap.jpg',       atm: [0.3, 0.6,  1.0 ], clouds: 'earth/2k_earth_clouds.jpg' },
  mars:    { a: 1.524, T: 1.881,  r: 0.532,  tilt:  25.19, rot:    1.026,color: 0xc1440e, tex: 'mars/2k_mars.jpg',                atm: [0.9, 0.4,  0.2 ] },
  jupiter: { a: 5.204, T: 11.86,  r: 11.209, tilt:   3.13, rot:    0.413,color: 0xc88b3a, tex: 'jupiter/2k_jupiter.jpg' },
  saturn:  { a: 9.537, T: 29.46,  r: 9.449,  tilt:  26.73, rot:    0.444,color: 0xead6a5, tex: 'saturn/2k_saturn.jpg',            rings: true },
  uranus:  { a: 19.19, T: 84.01,  r: 4.007,  tilt:  97.77, rot:   -0.718,color: 0x7de8e8, tex: 'uranus/2k_uranus.jpg',            atm: [0.5, 0.9,  0.9 ] },
  neptune: { a: 30.07, T: 164.8,  r: 3.883,  tilt:  28.32, rot:    0.671,color: 0x3f54ba, tex: 'neptune/2k_neptune.jpg',          atm: [0.2, 0.4,  1.0 ] },
}
const PLANET_ORDER = ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune']

// ── Atmosphere shaders (inline — no external file deps needed) ─────────────────
const ATM_VERT = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal  = normalize(normalMatrix * normal);
    vec4 wp  = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const ATM_FRAG = /* glsl */`
  uniform vec3  uColor;
  uniform float uStrength;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float rim = 1.0 - clamp(dot(vNormal, vViewDir), 0.0, 1.0);
    float i   = pow(rim, 2.5) * uStrength;
    gl_FragColor = vec4(uColor * i, i * uOpacity);
  }
`

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Resolve a package-relative texture path to a URL that works in Vite dev/prod. */
function assetURL(rel) {
  return new URL(`./assets/textures/${rel}`, import.meta.url).href
}

function loadTex(Three, rel) {
  const t = new Three.TextureLoader().load(assetURL(rel))
  t.colorSpace = Three.SRGBColorSpace
  return t
}

function makeAtmosphere(Three, parent, r, rgb) {
  const geo  = new Three.SphereGeometry(r * 1.025, 48, 48)
  const unif = {
    uColor:    { value: new Three.Vector3(...rgb) },
    uStrength: { value: 1.0 },
    uOpacity:  { value: 0.9 },
  }
  const mkMat = (side) => new Three.ShaderMaterial({
    uniforms: unif, vertexShader: ATM_VERT, fragmentShader: ATM_FRAG,
    blending: Three.AdditiveBlending, transparent: true, depthWrite: false, side,
  })
  parent.add(new Three.Mesh(geo, mkMat(Three.BackSide)))
  parent.add(new Three.Mesh(geo, mkMat(Three.FrontSide)))
}

function makeRingTexture(Three, size = 512) {
  const cv = document.createElement('canvas')
  cv.width = size; cv.height = 4
  const c = cv.getContext('2d')
  const g = c.createLinearGradient(0, 0, size, 0)
  g.addColorStop(0.00, 'rgba(80,65,50,0)')
  g.addColorStop(0.05, 'rgba(80,65,50,0.3)')
  g.addColorStop(0.08, 'rgba(100,80,60,0.45)')
  g.addColorStop(0.25, 'rgba(200,175,140,0.85)')
  g.addColorStop(0.35, 'rgba(215,190,155,0.95)')
  g.addColorStop(0.50, 'rgba(190,165,130,0.88)')
  g.addColorStop(0.55, 'rgba(15,10,8,0.05)')    // Cassini division
  g.addColorStop(0.58, 'rgba(15,10,8,0.05)')
  g.addColorStop(0.60, 'rgba(180,155,120,0.7)')
  g.addColorStop(0.74, 'rgba(170,145,110,0.65)')
  g.addColorStop(0.82, 'rgba(20,15,10,0.1)')    // Encke gap
  g.addColorStop(0.92, 'rgba(140,115,85,0.2)')
  g.addColorStop(1.00, 'rgba(140,115,85,0)')
  c.fillStyle = g; c.fillRect(0, 0, size, 4)
  return new Three.CanvasTexture(cv)
}

function fixRingUVs(geo, innerR, outerR) {
  const pos = geo.attributes.position, uv = geo.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i)
    uv.setXY(i, (Math.sqrt(x*x + y*y) - innerR) / (outerR - innerR), 0.5)
  }
  uv.needsUpdate = true
}

function easeInOut(t) {
  return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t
}

// ── Setup ──────────────────────────────────────────────────────────────────────

export async function setup(ctx) {
  const { Three } = ctx

  // CSS2DObject — dynamic import so the package degrades gracefully in blob-URL contexts
  let CSS2DObject = null
  try {
    const m = await import('three/addons/renderers/CSS2DRenderer.js')
    CSS2DObject = m.CSS2DObject
  } catch {}

  // Camera
  ctx.camera.position.set(0, 80, 200)
  ctx.camera.lookAt(0, 0, 0)
  ctx.controls.target.set(0, 0, 0)
  ctx.controls.minDistance = 20
  ctx.controls.maxDistance = 5000

  setupJourney(ctx)

  // Lighting
  ctx.add(new Three.PointLight(0xffeebb, 10000, 0, 2))
  ctx.add(new Three.AmbientLight(0x111122, 0.5))

  // Starfield
  const starVerts = new Float32Array(120000 * 3)
  for (let i = 0; i < starVerts.length; i++) starVerts[i] = (Math.random() - 0.5) * 120000
  const starGeo = new Three.BufferGeometry()
  starGeo.setAttribute('position', new Three.BufferAttribute(starVerts, 3))
  ctx._stars = ctx.add(new Three.Points(starGeo,
    new Three.PointsMaterial({ color: 0xffffff, size: 2.5, sizeAttenuation: true, transparent: true, opacity: 0.7 })
  ))

  // Sun — emissive sphere + halo
  ctx._sunMesh = ctx.add(new Three.Mesh(
    new Three.SphereGeometry(SUNR, 64, 64),
    new Three.MeshStandardMaterial({
      color: new Three.Color(1.0, 0.95, 0.7), emissive: new Three.Color(1.0, 0.75, 0.2),
      emissiveIntensity: 1.2, roughness: 0.4,
    })
  ))
  ctx.add(new Three.Mesh(
    new Three.SphereGeometry(SUNR * 1.35, 32, 32),
    new Three.MeshStandardMaterial({
      color: new Three.Color(1.0, 0.8, 0.3), transparent: true, opacity: 0.07,
      side: Three.BackSide, depthWrite: false,
    })
  ))

  // Planets
  ctx._planets    = {}  // name → outer orbit Group
  ctx._lodRoots   = {}  // name → LOD node (carries self-rotation)
  ctx._orbitLines = []
  ctx._labelDivs  = []  // [{ div, name }] for opacity fade
  const pickMeshes = [] // [{ m, name }] for raycasting

  for (const name of PLANET_ORDER) {
    const d = PLANETS[name]
    const r = d.r * PS

    // Outer orbit group — positioned each frame by orbital mechanics
    const orbit = new Three.Group()
    ctx.add(orbit)
    ctx._planets[name] = orbit

    // Inner tilted group — carries axial tilt + sphere + atmosphere + rings
    const tilted = new Three.Group()
    tilted.rotation.z = Three.MathUtils.degToRad(d.tilt)
    orbit.add(tilted)

    // Planet sphere with LOD
    const mat = new Three.MeshStandardMaterial({ map: loadTex(Three, d.tex), roughness: 0.85 })
    const mkSphere = (segs) => {
      const m = new Three.Mesh(new Three.SphereGeometry(r, segs, Math.round(segs / 2)), mat)
      m.castShadow = m.receiveShadow = true
      return m
    }
    const lod = new Three.LOD()
    lod.addLevel(mkSphere(128), 0)
    lod.addLevel(mkSphere(64),  400)
    lod.addLevel(mkSphere(32),  1200)
    lod.addLevel(mkSphere(16),  3000)
    tilted.add(lod)
    ctx._lodRoots[name] = lod
    lod.children.forEach(c => { if (c.isMesh) pickMeshes.push({ m: c, name }) })

    // Earth cloud layer
    if (d.clouds) {
      ctx._earthClouds = new Three.Mesh(
        new Three.SphereGeometry(r * 1.008, 64, 32),
        new Three.MeshStandardMaterial({ map: loadTex(Three, d.clouds), transparent: true, opacity: 0.5, depthWrite: false })
      )
      tilted.add(ctx._earthClouds)
    }

    // Atmosphere rim glow
    if (d.atm) makeAtmosphere(Three, tilted, r, d.atm)

    // Saturn rings
    if (d.rings) {
      const innerR = r * 1.11, outerR = r * 2.27
      const ringGeo = new Three.RingGeometry(innerR, outerR, 128)
      fixRingUVs(ringGeo, innerR, outerR)
      const ring = new Three.Mesh(ringGeo, new Three.MeshBasicMaterial({
        map: makeRingTexture(Three), transparent: true, depthWrite: false,
        side: Three.DoubleSide, opacity: 0.95,
      }))
      ring.rotation.x = Math.PI / 2
      tilted.add(ring)
    }

    // Orbit path
    const pts = []
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2
      pts.push(new Three.Vector3(d.a * AU * Math.cos(a), 0, d.a * AU * Math.sin(a)))
    }
    ctx._orbitLines.push(ctx.add(new Three.Line(
      new Three.BufferGeometry().setFromPoints(pts),
      new Three.LineBasicMaterial({ color: d.color, transparent: true, opacity: 0.15 })
    )))

    // CSS2D label
    if (CSS2DObject && ctx.labelRenderer) {
      const div = document.createElement('div')
      div.textContent = name.toUpperCase()
      div.style.cssText =
        'font-family:monospace;font-size:10px;color:rgba(170,220,255,0.7);' +
        'letter-spacing:0.2em;pointer-events:none;white-space:nowrap'
      const label = new CSS2DObject(div)
      label.position.set(0, r * 1.5, 0)
      orbit.add(label)
      ctx._labelDivs.push({ div, name })
    }
  }

  ctx._pickMeshes = pickMeshes

  // Moon
  const moonR = 0.273 * PS
  ctx._moonGroup = new Three.Group()
  ctx._moonGroup.add(new Three.Mesh(
    new Three.SphereGeometry(moonR, 32, 16),
    new Three.MeshStandardMaterial({ map: loadTex(Three, 'moon/2k_moon.jpg'), roughness: 0.95 })
  ))
  ctx.add(ctx._moonGroup)

  // Asteroid belt (instanced)
  const BELT_N = 3000
  ctx._belt = new Three.InstancedMesh(
    new Three.IcosahedronGeometry(0.08, 0),
    new Three.MeshStandardMaterial({ color: 0x9a8b7a, roughness: 0.95, metalness: 0.05 }),
    BELT_N
  )
  ctx._belt.castShadow = ctx._belt.receiveShadow = true
  const ba = ctx._beltAngles = new Float32Array(BELT_N)
  const br = ctx._beltRadii  = new Float32Array(BELT_N)
  const by = ctx._beltYs     = new Float32Array(BELT_N)
  const bs = ctx._beltScales = new Float32Array(BELT_N)
  const brot = ctx._beltRots = new Float32Array(BELT_N * 3)
  const bd   = ctx._beltDummy = new Three.Object3D()
  for (let i = 0; i < BELT_N; i++) {
    ba[i] = Math.random() * Math.PI * 2
    br[i] = 220 + Math.random() * 100
    by[i] = (Math.random() - 0.5) * 8
    bs[i] = 0.3 + Math.sin(i * 0.7) * 0.7 + 0.7
    brot[i*3]   = (i * 0.137) % (Math.PI * 2)
    brot[i*3+1] = (i * 0.251) % (Math.PI * 2)
    brot[i*3+2] = (i * 0.389) % (Math.PI * 2)
    bd.position.set(br[i] * Math.cos(ba[i]), by[i], br[i] * Math.sin(ba[i]))
    bd.rotation.set(brot[i*3], brot[i*3+1], brot[i*3+2])
    bd.scale.setScalar(bs[i]); bd.updateMatrix()
    ctx._belt.setMatrixAt(i, bd.matrix)
  }
  ctx._belt.instanceMatrix.needsUpdate = true
  ctx._beltN = BELT_N
  ctx.add(ctx._belt)

  // 'O' key toggles orbit lines
  ctx._orbitVisible = true
  ctx._onKey = (e) => {
    if (e.key !== 'o' && e.key !== 'O') return
    ctx._orbitVisible = !ctx._orbitVisible
    ctx._orbitLines.forEach(l => { l.visible = ctx._orbitVisible })
  }
  window.addEventListener('keydown', ctx._onKey)

  // Click-to-focus raycasting
  const raycaster = new Three.Raycaster()
  const mouse     = new Three.Vector2()
  ctx._onClick = (e) => {
    if (ctx._journey?.playing) return
    const rect = ctx.renderer.domElement.getBoundingClientRect()
    mouse.set(
      ((e.clientX - rect.left) / rect.width)  *  2 - 1,
      ((e.clientY - rect.top)  / rect.height) * -2 + 1,
    )
    raycaster.setFromCamera(mouse, ctx.camera)
    const hits = raycaster.intersectObjects(ctx._pickMeshes.map(p => p.m))
    if (hits.length) {
      const info = ctx._pickMeshes.find(p => p.m === hits[0].object)
      if (info) _startFocus(ctx, info.name)
    }
  }
  ctx.renderer.domElement.addEventListener('click', ctx._onClick)

  // Start button — positioned relative to canvas container
  const _btnContainer = ctx.renderer.domElement.parentElement
  let btn = _btnContainer.querySelector('#start-btn')
  if (!btn) {
    btn = document.createElement('button')
    btn.id = 'start-btn'
    btn.style.cssText =
      'position:absolute;bottom:48px;left:50%;transform:translateX(-50%);' +
      'background:transparent;border:1px solid rgba(100,170,255,0.4);' +
      'color:#aaddff;padding:14px 44px;cursor:pointer;font-size:12px;' +
      'border-radius:2px;z-index:50;font-family:"Courier New",monospace;' +
      'letter-spacing:0.3em;text-transform:uppercase'
    _btnContainer.appendChild(btn)
  }
  btn.textContent = 'Begin Journey'
  btn.style.display = 'block'
  btn.addEventListener('click', () => {
    btn.remove()
    setupAudio(ctx)
    startJourney(ctx)
  }, { once: true })
}

// ── Update ─────────────────────────────────────────────────────────────────────

export function update(ctx, dt) {
  if (!ctx._planets) return   // async setup() still in progress

  const { Three } = ctx
  const t = ctx.elapsed

  // Orbital positions + self-rotation
  for (const name of PLANET_ORDER) {
    const d     = PLANETS[name]
    const angle = (t / (d.T * YEAR)) * Math.PI * 2
    ctx._planets[name].position.set(d.a * AU * Math.cos(angle), 0, d.a * AU * Math.sin(angle))

    const rotDir    = d.rot < 0 ? -1 : 1
    const rotPeriod = Math.abs(d.rot) * DAY
    ctx._lodRoots[name].rotation.y = rotDir * (t / rotPeriod) * Math.PI * 2
  }

  // Earth cloud layer drifts slightly faster
  if (ctx._earthClouds) {
    ctx._earthClouds.rotation.y = (t / (0.95 * DAY)) * Math.PI * 2
  }

  // Moon orbit
  const moonAngle = (t / (0.0748 * YEAR)) * Math.PI * 2
  const ep = ctx._planets.earth.position
  ctx._moonGroup.position.set(
    ep.x + MOON_ORBIT_R * Math.cos(moonAngle), 0, ep.z + MOON_ORBIT_R * Math.sin(moonAngle)
  )

  // Asteroid belt
  for (let i = 0; i < ctx._beltN; i++) {
    const rad = ctx._beltRadii[i]
    const spd = 0.00008 * Math.sqrt(250 / rad)
    const ang = ctx._beltAngles[i] + t * spd
    const rs  = i * 3
    ctx._beltDummy.position.set(rad * Math.cos(ang), ctx._beltYs[i], rad * Math.sin(ang))
    ctx._beltDummy.rotation.set(
      ctx._beltRots[rs]   + t * 0.020,
      ctx._beltRots[rs+1] + t * 0.015,
      ctx._beltRots[rs+2] + t * 0.025,
    )
    ctx._beltDummy.scale.setScalar(ctx._beltScales[i])
    ctx._beltDummy.updateMatrix()
    ctx._belt.setMatrixAt(i, ctx._beltDummy.matrix)
  }
  ctx._belt.instanceMatrix.needsUpdate = true

  // Audio-reactive updates (bloom driven from inside audio.js via ctx.setBloom)
  updateAudio(ctx, dt)

  // Camera journey (overrides controls while active)
  if (ctx._journey?.playing && !journeyDone(ctx)) {
    ctx.controls.enabled = false
    updateJourney(ctx, dt)
  } else if (journeyDone(ctx) && !ctx._focusTween) {
    ctx.controls.enabled = true
  }

  // Planet focus tween (click-to-orbit)
  if (ctx._focusTween) {
    const tw = ctx._focusTween
    tw.t = Math.min(1, tw.t + dt / tw.dur)
    const e = easeInOut(tw.t)
    ctx.camera.position.lerpVectors(tw.fromPos, tw.toPos, e)
    ctx.controls.target.lerpVectors(tw.fromLook, tw.toLook, e)
    if (tw.t >= 1) { ctx._focusTween = null; ctx.controls.enabled = true }
  }

  // Label fade by camera proximity
  if (ctx._labelDivs.length) {
    const cam = ctx.camera.position
    for (const { div, name } of ctx._labelDivs) {
      const r    = PLANETS[name].r * PS
      const dist = cam.distanceTo(ctx._planets[name].position)
      div.style.opacity = Three.MathUtils.clamp((dist - r * 0.5) / (r * 1.5), 0, 1)
    }
  }
}

// ── Teardown ───────────────────────────────────────────────────────────────────

export function teardown(ctx) {
  teardownAudio(ctx)
  if (ctx._onKey)   window.removeEventListener('keydown', ctx._onKey)
  if (ctx._onClick) ctx.renderer?.domElement.removeEventListener('click', ctx._onClick)
  ctx.renderer?.domElement.parentElement.querySelector('#start-btn')?.remove()
}

// ── Private ────────────────────────────────────────────────────────────────────

function _startFocus(ctx, name) {
  if (ctx._journey?.playing) return
  const r = PLANETS[name].r * PS
  const planetPos = ctx._planets[name].position.clone()
  ctx._focusTween = {
    fromPos:  ctx.camera.position.clone(),
    fromLook: ctx.controls.target.clone(),
    toPos:    planetPos.clone().add(new ctx.Three.Vector3(r * 3.5, r * 1.5, r * 4.5)),
    toLook:   planetPos.clone(),
    t: 0, dur: 2.2,
  }
  ctx.controls.enabled = false
}

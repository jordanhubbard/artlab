import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { createRenderer }    from './renderer/WebGPURenderer.js'
import { SceneManager }      from './scene/SceneManager.js'
import { TextureManager }    from './loaders/TextureLoader.js'
import { CameraSystem }      from './camera/CameraSystem.js'
import { OrbitalMechanics }  from './orbital/OrbitalMechanics.js'
import { PLANET_DATA, PLANET_ORDER, MOON_DATA } from './orbital/planetData.js'
import { PLANET_SCALE }      from './utils/constants.js'
import { Starfield }         from './objects/Starfield.js'
import { Sun }               from './objects/Sun.js'
import { Planet }            from './objects/Planet.js'
import { Earth }             from './objects/Earth.js'
import { Saturn }            from './objects/Saturn.js'
import { Jupiter }           from './objects/Jupiter.js'
import { AsteroidBelt }      from './objects/AsteroidBelt.js'
import { OrbitLines }        from './objects/OrbitLines.js'
import { AudioEngine }       from './audio/AudioEngine.js'
import { SynthPads }         from './audio/SynthPads.js'
import { FFTPipeline }       from './audio/FFTPipeline.js'

// ──────────────────────────────────────────────────────────────────────────────
// UI helpers
// ──────────────────────────────────────────────────────────────────────────────
const $loading = document.getElementById('loading')
const $bar     = document.getElementById('loading-bar')
const $loadTxt = document.getElementById('loading-text')
const $startBtn = document.getElementById('start-btn')

function setProgress(pct, msg) {
  $bar.style.width   = pct + '%'
  $loadTxt.textContent = msg
}

// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  setProgress(10, 'Creating renderer…')

  const canvas = document.getElementById('canvas')
  const { renderer, isWebGPU } = await createRenderer(canvas)

  setProgress(25, 'Building scene…')

  // ── Scene ──────────────────────────────────────────────────────────────────
  const sceneManager = new SceneManager()
  const { scene }    = sceneManager

  // ── Textures ───────────────────────────────────────────────────────────────
  const texManager = new TextureManager()
  texManager.preloadPlaceholders(PLANET_DATA)

  // ── Camera ─────────────────────────────────────────────────────────────────
  const cam = new CameraSystem(renderer, scene)

  // ── Starfield ──────────────────────────────────────────────────────────────
  const starfield = new Starfield()
  scene.add(starfield.points)

  // ── Sun ────────────────────────────────────────────────────────────────────
  const sun = new Sun(texManager)
  scene.add(sun.group)

  setProgress(50, 'Building solar system…')

  // ── Planets ────────────────────────────────────────────────────────────────
  const planets = {}

  for (const name of PLANET_ORDER) {
    const data = PLANET_DATA[name]
    let planet

    if (name === 'earth') {
      planet = new Earth(texManager, data)
    } else if (name === 'saturn') {
      planet = new Saturn(texManager, data)
    } else if (name === 'jupiter') {
      planet = new Jupiter(texManager, data)
    } else {
      planet = new Planet(data, texManager)
    }

    scene.add(planet.group)
    planets[name] = planet
  }

  // ── Planet labels (CSS2DRenderer) ─────────────────────────────────────
  const labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:1'
  document.body.appendChild(labelRenderer.domElement)

  const labelDivs = {}
  for (const [name, planet] of Object.entries(planets)) {
    const div = document.createElement('div')
    div.textContent = PLANET_DATA[name].name.toUpperCase()
    div.style.cssText = [
      'font-family:monospace',
      'font-size:10px',
      'color:rgba(170,220,255,0.7)',
      'letter-spacing:0.2em',
      'pointer-events:none',
      'white-space:nowrap',
    ].join(';')
    const labelObj = new CSS2DObject(div)
    labelObj.position.set(0, PLANET_DATA[name].radius * PLANET_SCALE * 1.5, 0)
    planet.group.add(labelObj)
    labelDivs[name] = div
  }

  // ── Moon (orbits Earth) ───────────────────────────────────────────────────
  const moonData = MOON_DATA
  const moonMat  = new THREE.MeshStandardMaterial({
    map:       texManager.load(moonData.textures.map, moonData.color),
    roughness: moonData.roughness ?? 0.95,
    metalness: 0,
  })
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(moonData.radius * 2.5, 32, 32),
    moonMat
  )
  moonMesh.castShadow = moonMesh.receiveShadow = true
  const moonGroup = new THREE.Object3D()
  moonGroup.add(moonMesh)
  scene.add(moonGroup)

  // ── Asteroid Belt ──────────────────────────────────────────────────────────
  const belt = new AsteroidBelt()
  scene.add(belt.mesh)

  // ── Orbit lines ────────────────────────────────────────────────────────────
  const orbitLines = new OrbitLines()
  scene.add(orbitLines.group)

  window.addEventListener('keydown', (e) => {
    if (e.key === 'o' || e.key === 'O') orbitLines.toggle()
  })

  // ── Orbital mechanics ─────────────────────────────────────────────────────
  const orbits = new OrbitalMechanics(planets, sun, moonGroup)

  setProgress(70, 'Setting up post-processing…')

  // ── Post-processing ────────────────────────────────────────────────────────
  // Post-processing (UnrealBloom via EffectComposer) is now built into
  // WebGL2Backend.  The first call to renderer.render() initialises the
  // EffectComposer internally with the supplied scene + camera.

  // ── Audio (lazy — started on user click) ──────────────────────────────────
  const audio    = new AudioEngine()
  const fft      = new FFTPipeline()
  const pads     = new SynthPads(audio)

  setProgress(90, 'Ready.')

  // ── Clickable planet labels (raycasting) ──────────────────────────────────
  const raycaster  = new THREE.Raycaster()
  const mouseNDC   = new THREE.Vector2()
  const planetMeshes = []   // { mesh, name }

  for (const [name, planet] of Object.entries(planets)) {
    // Use the LOD object (first child of group) for raycasting
    const lod = planet.lod ?? planet.group.children[0]
    if (lod) planetMeshes.push({ obj: planet.group, lod, name })
  }

  renderer.domElement.addEventListener('click', (e) => {
    mouseNDC.x =  (e.clientX / window.innerWidth)  * 2 - 1
    mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouseNDC, cam.camera)

    // Build list of all visible sphere meshes for picking
    const pickMeshes = []
    for (const { lod, name } of planetMeshes) {
      if (lod && lod.isLOD) {
        lod.children.forEach(c => { if (c.isMesh) pickMeshes.push({ m: c, name }) })
      }
    }

    const hits = raycaster.intersectObjects(pickMeshes.map(x => x.m))
    if (hits.length > 0) {
      const hit  = hits[0]
      const info = pickMeshes.find(x => x.m === hit.object)
      if (info) cam.focusPlanet(planets[info.name], info.name)
    }
  })

  // ── Show UI ────────────────────────────────────────────────────────────────
  setTimeout(() => {
    $loading.style.display = 'none'
    $startBtn.style.display = 'block'
  }, 400)

  $startBtn.addEventListener('click', async () => {
    $startBtn.style.display = 'none'

    await audio.start()
    fft.connect(audio)
    await pads.init()  // pads trigger as camera approaches each planet via update()

    cam.startJourney(planets)
  })

  // ── Resize ─────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    cam.onResize()
    renderer.resize(window.innerWidth, window.innerHeight)
    labelRenderer.setSize(window.innerWidth, window.innerHeight)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Animation loop
  // ──────────────────────────────────────────────────────────────────────────
  const clock = new THREE.Clock()
  const sunPos = new THREE.Vector3()  // reuse each frame

  // Pre-compute planet distances for audio pads
  const camPos = new THREE.Vector3()

  function animate() {
    const delta   = clock.getDelta()
    const elapsed = clock.getElapsedTime()

    // 1. Orbital mechanics
    orbits.update(elapsed)

    // 2. Per-object updates
    fft.update()
    const audioData = fft.data

    sun.update(elapsed, audioData)
    sunPos.copy(sun.position)

    for (const [name, planet] of Object.entries(planets)) {
      if (planet.update) planet.update(elapsed, sunPos, audioData)
    }

    belt.update(elapsed)
    starfield.update(elapsed, audioData)

    // 3. Audio pads — distance-based volume
    if (pads._started) {
      cam.camera.getWorldPosition(camPos)
      const distances = {}
      for (const [name, planet] of Object.entries(planets)) {
        distances[name] = camPos.distanceTo(planet.mesh.position)
      }
      pads.update(distances)
    }

    // 4. Bloom strength reacts to audio bass
    if (audioData.bass > 0) {
      renderer.setBloomStrength(0.55 + audioData.bass * 0.35)
    }

    // 5. Camera
    cam.update(delta)

    // 6. Label opacity by camera distance
    cam.camera.getWorldPosition(camPos)
    for (const [name, planet] of Object.entries(planets)) {
      const r = PLANET_DATA[name].radius * PLANET_SCALE
      const dist = camPos.distanceTo(planet.mesh.position)
      labelDivs[name].style.opacity = THREE.MathUtils.clamp((dist - r * 0.5) / (r * 1.5), 0, 1)
    }

    // 7. Render
    renderer.render(scene, cam.camera)
    labelRenderer.render(scene, cam.camera)
  }

  renderer.setAnimationLoop(animate)
}

main().catch(err => {
  console.error('[main] Fatal error:', err)
  document.getElementById('loading-text').textContent = 'Error: ' + err.message
})

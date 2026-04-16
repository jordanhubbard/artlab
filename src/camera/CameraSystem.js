import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import gsap from 'gsap'
import { PLANET_SCALE, AU_SCALE } from '../utils/constants.js'
import { PLANET_DATA } from '../orbital/planetData.js'

export class CameraSystem {
  constructor(renderer, scene) {
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      200000
    )
    // Start at Earth orbital distance (will be set in startJourney)
    this.camera.position.set(15, 5, 20)
    this.camera.lookAt(0, 0, 0)

    this.controls = new OrbitControls(this.camera, renderer.domElement)
    this.controls.enableDamping   = true
    this.controls.dampingFactor   = 0.06
    this.controls.minDistance     = 2
    this.controls.maxDistance     = 8000
    this.controls.zoomSpeed       = 1.2
    this.controls.rotateSpeed     = 0.5
    this.controls.enabled = true

    this._scene    = scene
    this._renderer = renderer

    // Label element
    this._labelEl = document.getElementById('planet-label')
    this._hudEl   = document.getElementById('hud')

    this._focusTarget = null  // currently focused planet
  }

  startJourney(planets) {
    const earthPos = planets.earth?.mesh?.position ?? new THREE.Vector3(AU_SCALE, 0, 0)

    // Position camera in Earth orbit (close up to see atmosphere)
    this.camera.position.set(
      earthPos.x + 9,
      earthPos.y + 3,
      earthPos.z + 7
    )
    this.controls.target.copy(earthPos)
    this.controls.enabled = false

    const self = this
    const tl = gsap.timeline({
      onComplete() {
        self.controls.target.set(0, 0, 0)
        self.controls.enabled = true
        if (self._labelEl) self._labelEl.textContent = ''
      }
    })

    // Phase 1 (0-10s): orbit Earth, see atmosphere + Moon
    tl.to(this.camera.position, {
      duration: 10,
      x: earthPos.x + 14,
      y: earthPos.y + 6,
      z: earthPos.z + 12,
      ease: 'power2.inOut',
      onUpdate() { self.camera.lookAt(earthPos) },
      onStart() { if (self._labelEl) self._labelEl.textContent = 'Earth' }
    })

    // Phase 2 (10-24s): pull back to inner solar system
    tl.to(this.camera.position, {
      duration: 14,
      x: 80, y: 60, z: 180,
      ease: 'power3.inOut',
      onUpdate() { self.camera.lookAt(0, 0, 0) },
      onStart() { if (self._labelEl) self._labelEl.textContent = 'Inner System' }
    })

    // Phase 3 (24-42s): wide shot — full solar system
    tl.to(this.camera.position, {
      duration: 18,
      x: 200, y: 350, z: 700,
      ease: 'power2.inOut',
      onUpdate() { self.camera.lookAt(0, 0, 0) },
      onStart() { if (self._labelEl) self._labelEl.textContent = 'Solar System' }
    })

    // Phase 4 (42-55s): dramatic tilt down into the ecliptic plane
    tl.to(this.camera.position, {
      duration: 13,
      x: 100, y: 80, z: 500,
      ease: 'power1.inOut',
      onUpdate() { self.camera.lookAt(0, 0, 0) },
      onStart() { if (self._labelEl) self._labelEl.textContent = '' }
    })
  }

  /** Fly to a specific planet (called on click) */
  focusPlanet(planet, name) {
    if (!planet) return
    this.controls.enabled = false
    this._focusTarget = name

    const targetPos  = planet.mesh.position.clone()
    const data       = PLANET_DATA[name]
    const r          = (data?.radius ?? 1.0) * PLANET_SCALE
    const offset     = new THREE.Vector3(r * 5, r * 2, r * 7)

    const self = this
    gsap.to(this.camera.position, {
      duration: 2.8,
      x: targetPos.x + offset.x,
      y: targetPos.y + offset.y,
      z: targetPos.z + offset.z,
      ease: 'power3.inOut',
      onUpdate() { self.camera.lookAt(targetPos) },
      onComplete() {
        self.controls.target.copy(targetPos)
        self.controls.enabled = true
        if (self._labelEl) self._labelEl.textContent = data?.name ?? name
      }
    })
  }

  update(delta) {
    if (this.controls.enabled) this.controls.update(delta)

    // Update HUD
    if (this._hudEl) {
      const dist = this.camera.position.length() / AU_SCALE
      this._hudEl.innerHTML =
        `CAM ${dist.toFixed(2)} AU<br>` +
        `ALT ${this.camera.position.y.toFixed(0)}`
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
  }
}

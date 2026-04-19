import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { IRenderer } from './IRenderer.js'

export class WebGL2Backend extends IRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    super()

    this._renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })

    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._renderer.setSize(window.innerWidth, window.innerHeight)
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping
    this._renderer.toneMappingExposure = 0.75
    this._renderer.outputColorSpace = THREE.SRGBColorSpace
    this._renderer.shadowMap.enabled = true
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Post-processing state — initialized lazily when render() is first called
    // with a scene+camera, or explicitly via setPostProcessing()
    this._composer = null
    this._bloomPass = null
    this._bloomStrengthPending = 0.55  // default bloom strength

    this._scene  = null
    this._camera = null

    const badge = document.getElementById('webgpu-badge')
    if (badge) {
      badge.textContent = '▸ WebGL2'
      badge.style.color = 'rgba(255, 200, 100, 0.4)'
    }
  }

  // ── IRenderer interface ──────────────────────────────────────────────────────

  /** @returns {HTMLCanvasElement} */
  get domElement() {
    return this._renderer.domElement
  }

  /** @returns {{ isWebGPU: boolean, backend: string }} */
  get capabilities() {
    return { isWebGPU: false, backend: 'webgl2' }
  }

  /**
   * Render a frame.  On the first call the EffectComposer is initialised with
   * the supplied scene and camera so post-processing works correctly.
   *
   * @param {THREE.Scene}  scene
   * @param {THREE.Camera} camera
   */
  render(scene, camera) {
    // Lazily initialise (or re-initialise when scene/camera change)
    if (!this._composer || this._scene !== scene || this._camera !== camera) {
      this._initComposer(scene, camera)
    }

    if (this._composer) {
      this._composer.render()
    } else {
      this._renderer.render(scene, camera)
    }
  }

  /**
   * @param {number} w
   * @param {number} h
   */
  resize(w, h) {
    this._renderer.setSize(w, h)
    if (this._composer) {
      this._composer.setSize(w, h)
      this._bloomPass?.setSize(w, h)
    }
  }

  /**
   * @param {number} v  bloom strength 0–3
   */
  setBloomStrength(v) {
    this._bloomStrengthPending = v
    if (this._bloomPass) this._bloomPass.strength = v
  }

  /**
   * Configure post-processing via a descriptor object.
   * Currently supports:
   *   { type: 'bloom', strength, radius, threshold }
   *
   * @param {{ type: string, [key: string]: any }} desc
   */
  setPostProcessing(desc) {
    if (!desc || !desc.type) return
    if (desc.type === 'bloom') {
      if (this._bloomPass) {
        if (desc.strength   !== undefined) this._bloomPass.strength   = desc.strength
        if (desc.radius     !== undefined) this._bloomPass.radius     = desc.radius
        if (desc.threshold  !== undefined) this._bloomPass.threshold  = desc.threshold
      }
    }
  }

  /**
   * @param {Function|null} callback
   */
  setAnimationLoop(callback) {
    this._renderer.setAnimationLoop(callback)
  }

  dispose() {
    this._renderer.setAnimationLoop(null)
    this._composer = null
    this._bloomPass = null
    this._renderer.dispose()
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  _initComposer(scene, camera) {
    this._scene  = scene
    this._camera = camera

    try {
      const composer = new EffectComposer(this._renderer)
      composer.addPass(new RenderPass(scene, camera))

      const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        this._bloomStrengthPending, // strength
        0.25,                       // radius
        0.85                        // threshold
      )
      composer.addPass(bloom)
      composer.addPass(new OutputPass())

      this._composer  = composer
      this._bloomPass = bloom

      console.info('[WebGL2Backend] EffectComposer + UnrealBloom active')
    } catch (e) {
      console.warn('[WebGL2Backend] EffectComposer failed, using direct render:', e.message)
      this._composer  = null
      this._bloomPass = null
    }
  }
}

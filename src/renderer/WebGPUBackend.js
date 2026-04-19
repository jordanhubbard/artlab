import { WebGPURenderer, PostProcessing, pass, uniform } from 'three/webgpu'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import * as Three from 'three'
import { IRenderer } from './IRenderer.js'

export class WebGPUBackend extends IRenderer {
  constructor(canvas) {
    super()

    this._renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })

    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._renderer.setSize(window.innerWidth, window.innerHeight)
    this._renderer.toneMapping = Three.ACESFilmicToneMapping
    this._renderer.toneMappingExposure = 0.75

    this._postProcessing = null
    this._bloomStrengthUniform = uniform(0.55)
    this._scene  = null
    this._camera = null
  }

  /** Must be awaited before calling setAnimationLoop or render. */
  async init() {
    await this._renderer.init()

    const badge = document.getElementById('webgpu-badge')
    if (badge) {
      badge.textContent = '▸ WebGPU'
      badge.style.color = 'rgba(100, 200, 255, 0.6)'
    }
  }

  // ── IRenderer interface ──────────────────────────────────────────────────────

  get domElement() { return this._renderer.domElement }

  get capabilities() { return { isWebGPU: true, backend: 'webgpu' } }

  /**
   * Drive the render loop via the renderer's own scheduler.
   * The callback is called first (scene updates), then the frame is composited.
   *
   * @param {Function|null} callback
   */
  setAnimationLoop(callback) {
    this._renderer.setAnimationLoop(async (time, xrFrame) => {
      if (callback) callback(time, xrFrame)

      if (this._postProcessing) {
        await this._postProcessing.renderAsync()
      } else if (this._scene && this._camera) {
        await this._renderer.renderAsync(this._scene, this._camera)
      }
    })
  }

  /**
   * Store the scene/camera and set up post-processing on first call.
   * Actual GPU work happens in the setAnimationLoop callback.
   *
   * @param {Three.Scene}  scene
   * @param {Three.Camera} camera
   */
  render(scene, camera) {
    if (scene !== this._scene || camera !== this._camera) {
      this._scene  = scene
      this._camera = camera
      this._initPostProcessing(scene, camera)
    }
  }

  resize(w, h) {
    this._renderer.setSize(w, h)
  }

  setBloomStrength(v) {
    this._bloomStrengthUniform.value = v
  }

  setPostProcessing(desc) {
    if (desc?.type === 'bloom') {
      if (desc.strength  !== undefined) this.setBloomStrength(desc.strength)
    }
  }

  dispose() {
    this._renderer.setAnimationLoop(null)
    this._postProcessing = null
    this._renderer.dispose()
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _initPostProcessing(scene, camera) {
    try {
      const scenePass = pass(scene, camera)
      const bloomPass = bloom(scenePass, this._bloomStrengthUniform, 0.25, 0.85)

      this._postProcessing = new PostProcessing(this._renderer)
      this._postProcessing.outputNode = bloomPass

      console.info('[WebGPUBackend] PostProcessing + bloom active')
    } catch (e) {
      console.warn('[WebGPUBackend] PostProcessing setup failed, using direct renderAsync:', e.message)
      this._postProcessing = null
    }
  }
}

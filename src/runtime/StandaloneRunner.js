import * as THREE from 'three'
import { OrbitControls }  from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer }  from 'three/addons/renderers/CSS2DRenderer.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js'

/**
 * Full-featured runtime for running an Artlab package standalone (outside the IDE).
 *
 * Provides the same setup(ctx)/update(ctx,dt)/teardown(ctx) contract as PreviewPane
 * but adds bloom post-processing, CSS2D label renderer, and setBloom() in the ctx.
 *
 * Usage:
 *   const runner = new StandaloneRunner(canvas)
 *   runner.run(await import('../examples/solar-system/solar-system.js'))
 */
export class StandaloneRunner {
  constructor(canvas) {
    this._canvas = canvas

    // ── Renderer ────────────────────────────────────────────────────────────────
    this._renderer = new THREE.WebGLRenderer({
      canvas,
      antialias:        true,
      alpha:            false,
      powerPreference:  'high-performance',
    })
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._renderer.setSize(window.innerWidth, window.innerHeight)
    this._renderer.toneMapping         = THREE.ACESFilmicToneMapping
    this._renderer.toneMappingExposure = 0.75
    this._renderer.outputColorSpace    = THREE.SRGBColorSpace
    this._renderer.shadowMap.enabled   = true
    this._renderer.shadowMap.type      = THREE.PCFSoftShadowMap

    // ── Scene + camera ───────────────────────────────────────────────────────────
    this._scene  = new THREE.Scene()
    this._camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200000)

    // ── Orbit controls ───────────────────────────────────────────────────────────
    this._controls = new OrbitControls(this._camera, canvas)
    this._controls.enableDamping = true
    this._controls.dampingFactor = 0.07
    this._controls.zoomSpeed     = 1.2
    this._controls.rotateSpeed   = 0.5

    // ── CSS2D label renderer ─────────────────────────────────────────────────────
    this._labelRenderer = new CSS2DRenderer()
    this._labelRenderer.setSize(window.innerWidth, window.innerHeight)
    this._labelRenderer.domElement.style.cssText =
      'position:absolute;top:0;left:0;pointer-events:none;z-index:1'
    document.body.appendChild(this._labelRenderer.domElement)

    // ── Bloom post-processing ────────────────────────────────────────────────────
    this._bloomPass = null
    this._composer  = null
    this._initComposer()

    // ── Clock + module ───────────────────────────────────────────────────────────
    this._clock = new THREE.Clock()
    this._mod   = null
    this._ctx   = null

    window.addEventListener('resize', () => this._onResize())
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Load and run a package module.  Hides the loading overlay when setup() resolves.
   * @param {{ setup?: Function, update?: Function, teardown?: Function }} mod
   */
  async run(mod) {
    this._mod = mod
    this._ctx = this._makeCtx()

    if (typeof mod.setup === 'function') {
      await mod.setup(this._ctx)
    }

    // Hide standard loading overlay if present
    const loading = document.getElementById('loading')
    if (loading) loading.style.display = 'none'

    this._clock.start()
    this._loop()
  }

  // ── Context ──────────────────────────────────────────────────────────────────

  _makeCtx() {
    const self = this
    return {
      THREE,
      scene:         this._scene,
      camera:        this._camera,
      renderer:      this._renderer,
      controls:      this._controls,
      labelRenderer: this._labelRenderer,

      add:    (obj) => { self._scene.add(obj); return obj },
      remove: (obj) => { self._scene.remove(obj) },

      /** Adjust bloom strength (0–3).  Called every frame by audio-reactive packages. */
      setBloom(strength) {
        if (self._bloomPass) self._bloomPass.strength = strength
      },

      elapsed: 0,
    }
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  _initComposer() {
    const composer = new EffectComposer(this._renderer)
    composer.addPass(new RenderPass(this._scene, this._camera))

    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55,   // strength
      0.25,   // radius
      0.85    // threshold
    )
    composer.addPass(this._bloomPass)
    composer.addPass(new OutputPass())
    this._composer = composer
  }

  _loop() {
    requestAnimationFrame(() => this._loop())

    const dt = this._clock.getDelta()
    if (this._ctx) this._ctx.elapsed = this._clock.getElapsedTime()

    this._controls.update()

    if (this._mod?.update && this._ctx) {
      try {
        this._mod.update(this._ctx, dt)
      } catch (e) {
        console.error('[StandaloneRunner] update() threw:', e)
      }
    }

    this._composer.render()
    this._labelRenderer.render(this._scene, this._camera)
  }

  _onResize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this._camera.aspect = w / h
    this._camera.updateProjectionMatrix()
    this._renderer.setSize(w, h)
    this._composer?.setSize(w, h)
    this._labelRenderer.setSize(w, h)
  }
}

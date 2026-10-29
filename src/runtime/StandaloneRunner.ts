import * as Three from 'three'
import { SceneContext } from './SceneContext.ts'
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
 * using the same shared context factory, bloom, and CSS2D labels.
 *
 * Usage:
 *   const runner = new StandaloneRunner(canvas)
 *   runner.run(await import('../examples/solar-system/solar-system.ts'))
 */
export class StandaloneRunner {
  constructor(canvas) {
    this._canvas = canvas

    // ── Renderer ────────────────────────────────────────────────────────────────
    this._renderer = new Three.WebGLRenderer({
      canvas,
      antialias:        true,
      alpha:            false,
      powerPreference:  'high-performance',
    })
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._renderer.setSize(window.innerWidth, window.innerHeight)
    this._renderer.toneMapping         = Three.ACESFilmicToneMapping
    this._renderer.toneMappingExposure = 0.75
    this._renderer.outputColorSpace    = Three.SRGBColorSpace
    this._renderer.shadowMap.enabled   = true
    this._renderer.shadowMap.type      = Three.PCFSoftShadowMap
    this._renderer.setClearColor(0x000000, 1)

    // ── Scene + camera ───────────────────────────────────────────────────────────
    this._scene  = new Three.Scene()
    this._camera = new Three.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200000)

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
    this._clock = new Three.Clock()
    this._mod   = null
    this._ctx   = null

    this._resizeHandler = () => this._onResize()
    window.addEventListener('resize', this._resizeHandler)
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Load and run a package module.  Hides the loading overlay when setup() resolves.
   * @param {{ setup?: Function, update?: Function, teardown?: Function }} mod
   */
  async run(mod) {
    const token = this._runToken = (this._runToken ?? 0) + 1
    await this._stopModule()
    if (token !== this._runToken) return
    this._mod = mod
    this._ctx = this._makeCtx()
    const context = this._ctx

    if (typeof mod.setup === 'function') {
      try { await mod.setup(context) } catch (error) {
        if (this._ctx === context) await this.stop()
        throw error
      }
    }

    if (this._ctx !== context) return

    // Hide standard loading overlay if present
    const loading = document.getElementById('loading')
    if (loading) loading.style.display = 'none'

    this._clock.start()
    this._loop()
  }

  // ── Context ──────────────────────────────────────────────────────────────────

  _makeCtx() {
    return new SceneContext({
      scene: this._scene,
      camera: this._camera,
      renderer: this._renderer,
      controls: this._controls,
      labelRenderer: this._labelRenderer,
      setBloom: (strength = 0) => { this._bloomPass.strength = Math.max(0, strength) },
      setHelp: text => {
        let el = document.getElementById('artlab-help')
        if (!el) {
          el = document.createElement('div')
          el.id = 'artlab-help'
          el.style.cssText = 'position:fixed;top:10px;left:10px;z-index:100;color:#aaddff;background:#080d18cc;padding:8px;font:12px monospace;pointer-events:none'
          document.body.appendChild(el)
        }
        el.textContent = text == null ? '' : String(text)
      },
    })
  }

  stop() {
    this._runToken = (this._runToken ?? 0) + 1
    return this._stopModule()
  }

  _stopModule() {
    cancelAnimationFrame(this._animationId)
    if (!this._ctx) return this._stopping ?? Promise.resolve()
    const context = this._ctx, mod = this._mod
    this._ctx = null
    this._mod = null
    this._clock.stop()
    this._stopping = (async () => {
      try { await mod?.teardown?.(context) } finally {
        this._scene.background = null
        this._scene.fog = null
        this._bloomPass.strength = 0
        this._controls.enabled = true
        this._controls.target.set(0, 0, 0)
        this._camera.position.set(0, 2, 6)
        this._controls.update()
        document.getElementById('artlab-help')?.remove()
        await context.dispose()
      }
    })()
    return this._stopping
  }

  async dispose() {
    try { await this.stop() } finally {
      window.removeEventListener('resize', this._resizeHandler)
      this._controls.dispose()
      this._composer.dispose()
      this._renderer.dispose()
      this._labelRenderer.domElement.remove()
    }
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  _initComposer() {
    const composer = new EffectComposer(this._renderer)
    composer.addPass(new RenderPass(this._scene, this._camera))

    this._bloomPass = new UnrealBloomPass(
      new Three.Vector2(window.innerWidth, window.innerHeight),
      0.55,   // strength
      0.25,   // radius
      0.85    // threshold
    )
    composer.addPass(this._bloomPass)
    composer.addPass(new OutputPass())
    this._composer = composer
  }

  _loop() {
    this._animationId = requestAnimationFrame(() => this._loop())

    const dt = this._clock.getDelta()
    if (this._ctx) this._ctx.elapsed += dt

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

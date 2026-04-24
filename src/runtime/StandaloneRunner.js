import * as Three from 'three'
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
      Three,
      scene:         this._scene,
      camera:        this._camera,
      renderer:      this._renderer,
      controls:      this._controls,
      labelRenderer: this._labelRenderer,

      add:    (obj) => { self._scene.add(obj); return obj },
      remove: (obj) => { self._scene.remove(obj) },

      setBloom(strength) {
        if (self._bloomPass) self._bloomPass.strength = strength
      },

      /**
       * setHelp(text) — display a one-line interaction hint. In the standalone
       * runtime this renders as a small overlay at the top of the canvas; the
       * IDE overrides this to render it in the preview toolbar.
       */
      setHelp(text) {
        let el = document.getElementById('artlab-help')
        if (!el) {
          el = document.createElement('div')
          el.id = 'artlab-help'
          el.style.cssText = [
            'position:fixed', 'top:10px', 'left:50%',
            'transform:translateX(-50%)', 'z-index:100',
            'padding:4px 14px', 'pointer-events:none',
            'background:rgba(0,0,0,0.6)', 'color:#70c8ff',
            'font-family:monospace', 'font-size:12px',
            'border-radius:3px', 'letter-spacing:0.04em',
          ].join(';')
          document.body.appendChild(el)
        }
        const t = text == null ? '' : String(text)
        el.textContent = t
        el.style.display = t ? 'block' : 'none'
      },

      // Three.js shorthand constructors (mirrors PreviewPane ctx)
      vec2:  (x, y)       => new Three.Vector2(x, y),
      vec3:  (x, y, z)    => new Three.Vector3(x, y, z),
      vec4:  (x, y, z, w) => new Three.Vector4(x, y, z, w),
      color: (r, g, b)    => new Three.Color(r, g, b),
      quat:  (x, y, z, w) => new Three.Quaternion(x, y, z, w),
      range: (a, b) => {
        const start = b === undefined ? 0 : a
        const end   = b === undefined ? a : b
        return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i)
      },

      elapsed: 0,
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

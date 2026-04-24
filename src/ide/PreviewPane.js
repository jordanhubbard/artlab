/**
 * PreviewPane — live preview of an Artlab JavaScript package.
 *
 * Each call to run() tears down the previous scene and imports the
 * new JS module via a blob URL. The module must export:
 *
 *   export function setup(ctx)       — called once on load
 *   export function update(ctx, dt)  — called every frame (dt seconds)
 *   export function teardown(ctx)    — optional, called on unload
 *
 * The ctx object provides Three.js, OrbitControls, all Artlab stdlib
 * helpers, and scene management — no imports required:
 *
 *   export function setup(ctx) {
 *     const { Three, sphere, mesh, ambient, controls } = ctx
 *     ctx.add(mesh(sphere(1), { color: 0x336699 }))
 *     ctx.add(ambient(0x112244, 0.5))
 *     controls.target.set(0, 0, 0)   // optional: orbit focus
 *   }
 */

import * as Three from 'three'
import { OrbitControls }    from 'three/addons/controls/OrbitControls.js'
import { EffectComposer }   from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass }       from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass }  from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass }       from 'three/addons/postprocessing/OutputPass.js'
import { CSS2DRenderer }    from 'three/addons/renderers/CSS2DRenderer.js'
import * as _geo    from '../stdlib/geometry.js'
import * as _lights from '../stdlib/lights.js'
import * as _math   from '../stdlib/math.js'

export class PreviewPane {
  /** @param {HTMLElement} container */
  constructor(container) {
    this._container = container

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;'
    container.appendChild(this.canvas)

    this._renderer = new Three.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false })
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._renderer.setClearColor(0x000000, 1)
    this._renderer.outputColorSpace    = Three.SRGBColorSpace
    this._renderer.toneMapping         = Three.ACESFilmicToneMapping
    this._renderer.toneMappingExposure = 0.75
    this._renderer.shadowMap.enabled   = true

    this._scene  = new Three.Scene()
    this._camera = new Three.PerspectiveCamera(60, 1, 0.01, 100000)
    this._camera.position.set(0, 2, 6)

    // OrbitControls — enabled by default; packages can configure via ctx.controls
    this._controls = new OrbitControls(this._camera, this.canvas)
    this._controls.enableDamping  = true
    this._controls.dampingFactor  = 0.07
    this._controls.zoomSpeed      = 1.2
    this._controls.rotateSpeed    = 0.5
    this._controls.minDistance    = 0.1
    this._controls.maxDistance    = 500000

    // Bloom post-processing (strength starts at 0 = off)
    this._bloomPass = new UnrealBloomPass(new Three.Vector2(400, 300), 0, 0.4, 0.0)
    this._composer  = new EffectComposer(this._renderer)
    this._composer.addPass(new RenderPass(this._scene, this._camera))
    this._composer.addPass(this._bloomPass)
    this._composer.addPass(new OutputPass())

    // CSS2D label renderer — absolute overlay inside the canvas container
    this._css2DRenderer = new CSS2DRenderer()
    Object.assign(this._css2DRenderer.domElement.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none',
    })
    container.appendChild(this._css2DRenderer.domElement)

    // Idle placeholder lights (removed as soon as a module loads)
    this._idleLight = new Three.AmbientLight(0x445566, 0.8)
    this._scene.add(this._idleLight)

    this._animationId    = null
    this._currentMod     = null
    this._ctx            = null
    this._blobUrl        = null
    this._running        = false
    this._elapsed        = 0
    this._clock          = new Three.Clock(false)
    this._assetFiles     = new Map()
    this._textureBlobUrls = []

    this._ro = new ResizeObserver(() => this._onResize())
    this._ro.observe(container)
    this._onResize()

    this._loop()
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Load and run a JavaScript package.
   * @param {{ manifest: object, artFiles: Map<string,string> }} pkg
   */
  async run(pkg) {
    const { manifest, artFiles, assetFiles = new Map() } = pkg
    this._assetFiles = assetFiles
    this._unloadModule()

    const entryName = manifest.entry
      ?? [...artFiles.keys()].find(k => k.endsWith('.js'))
      ?? ''

    if (!entryName || !artFiles.has(entryName)) {
      this._showError(`Entry file "${entryName}" not found in package`)
      return
    }

    const jsSrc  = artFiles.get(entryName)
    const blobUrl = URL.createObjectURL(new Blob([jsSrc], { type: 'text/javascript' }))
    this._blobUrl = blobUrl

    let mod
    try {
      mod = await import(/* @vite-ignore */ blobUrl)
    } catch (err) {
      URL.revokeObjectURL(blobUrl)
      this._blobUrl = null
      this._showError(`Import failed:\n${err.message}`)
      return
    }

    this._currentMod = mod
    this._elapsed    = 0
    this._ctx        = this._makeContext()

    this._clearUserObjects()

    if (typeof mod.setup === 'function') {
      try {
        await mod.setup(this._ctx)
      } catch (err) {
        this._showError(`setup() threw:\n${err.message}\n${err.stack ?? ''}`)
        return
      }
    }

    this._running = true
    this._clock.start()
  }

  async reload(pkg) { return this.run(pkg) }

  /**
   * Run an already-imported ES module directly, skipping the blob URL step.
   * Used by the Examples gallery to load built-in examples that have real URLs
   * and may use relative imports (which blob URLs would break).
   * @param {object} mod — an ES module object with optional setup/update/teardown exports
   */
  async runFromModule(mod) {
    this._unloadModule()
    this._currentMod = mod
    this._elapsed    = 0
    this._ctx        = this._makeContext()
    this._clearUserObjects()
    if (typeof mod.setup === 'function') {
      try {
        await mod.setup(this._ctx)
      } catch (err) {
        this._showError(`setup() threw:\n${err.message}\n${err.stack ?? ''}`)
        return
      }
    }
    this._running = true
    this._clock.start()
  }

  dispose() {
    this._running = false
    cancelAnimationFrame(this._animationId)
    this._unloadModule()
    this._controls.dispose()
    this._ro.disconnect()
    this._renderer.dispose()
    this._composer.dispose()
    this._css2DRenderer.domElement.remove()
    this.canvas.remove()
  }

  // ── Context object ──────────────────────────────────────────────────────────

  _makeContext() {
    const self  = this
    const added = []

    const ctx = {
      // ── Three.js core ───────────────────────────────────────────────────────
      Three,
      scene:         this._scene,
      camera:        this._camera,
      renderer:      this._renderer,
      /** OrbitControls instance — configure target, min/maxDistance, etc. */
      controls:      this._controls,
      /** CSS2DRenderer — use with Three.CSS2DObject for 3D-tracked DOM labels */
      labelRenderer: this._css2DRenderer,

      // ── Scene management ────────────────────────────────────────────────────
      add(obj)    { self._scene.add(obj); added.push(obj); return obj },
      remove(obj) {
        self._scene.remove(obj)
        const i = added.indexOf(obj); if (i >= 0) added.splice(i, 1)
      },

      // ── Geometry factories ──────────────────────────────────────────────────
      sphere:   _geo.sphere,
      box:      _geo.box,
      cylinder: _geo.cylinder,
      torus:    _geo.torus,
      plane:    _geo.plane,
      ring:     _geo.ring,
      cone:     _geo.cone,
      /** mesh(geometry, options) — options support all MeshStandardMaterial props */
      mesh:     _geo.mesh,

      // ── Light factories ─────────────────────────────────────────────────────
      ambient:     _lights.ambient,
      point:       _lights.point,
      directional: _lights.directional,
      spot:        _lights.spot,
      hemisphere:  _lights.hemisphere,

      // ── Math helpers ────────────────────────────────────────────────────────
      lerp:       _math.lerp,
      clamp:      _math.clamp,
      map:        _math.map,
      smoothstep: _math.smoothstep,
      rad:        _math.rad,
      deg:        _math.deg,

      // ── Three.js shorthand constructors ─────────────────────────────────────
      // These replace what the DSL provided as syntax; e.g. ctx.vec3(1,2,3)
      // instead of new Three.Vector3(1,2,3).
      vec2:  (x, y)          => new Three.Vector2(x, y),
      vec3:  (x, y, z)       => new Three.Vector3(x, y, z),
      vec4:  (x, y, z, w)    => new Three.Vector4(x, y, z, w),
      color: (r, g, b)       => new Three.Color(r, g, b),
      quat:  (x, y, z, w)    => new Three.Quaternion(x, y, z, w),

      // ── Iteration helpers ────────────────────────────────────────────────────
      /** range(n) → [0,1,…,n-1]  or  range(a,b) → [a,a+1,…,b-1] */
      range: (a, b) => {
        const start = b === undefined ? 0 : a
        const end   = b === undefined ? a : b
        return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i)
      },

      // ── Assets ──────────────────────────────────────────────────────────────
      loadTexture(path) {
        const bytes = self._assetFiles?.get(path)
        if (bytes) {
          const ext  = path.split('.').pop().toLowerCase()
          const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
          const url  = URL.createObjectURL(new Blob([bytes], { type: mime }))
          self._textureBlobUrls.push(url)
          return new Three.TextureLoader().load(url)
        }
        return new Three.TextureLoader().load(path)
      },

      // ── Time ────────────────────────────────────────────────────────────────
      elapsed: 0,

      // ── Post-processing ─────────────────────────────────────────────────────
      /** setBloom(strength) — 0 disables, typical range 0.3–2.0 */
      setBloom(strength = 0) { self._bloomPass.strength = Math.max(0, strength) },

      // ── UI hints ────────────────────────────────────────────────────────────
      /**
       * setHelp(text) — show a one-line interaction hint above the preview
       * (e.g. "Click to spawn, Space to reset"). Pass '' or null to clear.
       * Call this in setup() whenever your sketch responds to mouse or keyboard.
       */
      setHelp(text) {
        const el = document.getElementById('canvas-help')
        if (el) el.textContent = text == null ? '' : String(text)
      },

      _added:    added,
      _userVars: {},
    }

    return ctx
  }

  // ── Render loop ─────────────────────────────────────────────────────────────

  _loop() {
    this._animationId = requestAnimationFrame(() => this._loop())

    const dt = this._clock.running ? this._clock.getDelta() : 0
    this._elapsed += dt
    if (this._ctx) this._ctx.elapsed = this._elapsed

    this._controls.update()

    if (this._running && typeof this._currentMod?.update === 'function') {
      try {
        this._currentMod.update(this._ctx, dt)
      } catch (err) {
        this._showError(`update() threw:\n${err.message}`)
      }
    }

    // Use composer for bloom-capable rendering
    this._composer.render(dt)
    // Render CSS2D labels on top
    this._css2DRenderer.render(this._scene, this._camera)
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  _clearUserObjects() {
    // Remove idle placeholder light when a module takes over
    if (this._idleLight.parent) this._scene.remove(this._idleLight)

    for (const obj of [...(this._ctx?._added ?? [])]) {
      this._scene.remove(obj)
      obj.geometry?.dispose?.()
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.())
      else obj.material?.dispose?.()
    }
    if (this._ctx) this._ctx._added.length = 0

    // Reset bloom to off between examples
    this._bloomPass.strength = 0

    // Reset controls to neutral defaults
    this._controls.enabled     = true
    this._controls.minDistance = 0.1
    this._controls.maxDistance = 500000
    this._controls.target.set(0, 0, 0)
    this._camera.position.set(0, 2, 6)
    this._camera.lookAt(0, 0, 0)
    this._controls.update()
  }

  _unloadModule() {
    if (this._currentMod) {
      try { this._currentMod.teardown?.(this._ctx) } catch {}
    }
    this._clearUserObjects()
    if (this._blobUrl) { URL.revokeObjectURL(this._blobUrl); this._blobUrl = null }
    for (const url of this._textureBlobUrls) URL.revokeObjectURL(url)
    this._textureBlobUrls = []
    this._currentMod = null
    this._ctx        = null
    this._running    = false
    this._clock.stop()

    // Clear any interaction hint from the previous example.
    const helpEl = document.getElementById('canvas-help')
    if (helpEl) helpEl.textContent = ''
    this._clearError()

    // Restore idle light when no module is loaded
    this._scene.add(this._idleLight)
  }

  _onResize() {
    const w = this._container.clientWidth  || 400
    const h = this._container.clientHeight || 300
    this._renderer.setSize(w, h, false)
    this._composer.setSize(w, h)
    this._css2DRenderer.setSize(w, h)
    this._camera.aspect = w / h
    this._camera.updateProjectionMatrix()
  }

  _showError(msg) {
    this._running = false
    console.error('[PreviewPane]', msg)
    this.onError?.(msg)
    let ov = this._container.querySelector('.preview-error')
    if (!ov) {
      ov = document.createElement('div')
      ov.className = 'preview-error'
      Object.assign(ov.style, {
        position: 'absolute', inset: '0',
        background: 'rgba(10,10,18,0.92)', color: '#ff6b6b',
        fontFamily: 'monospace', fontSize: '12px',
        padding: '16px', overflow: 'auto', whiteSpace: 'pre-wrap', zIndex: '10',
      })
      this._container.style.position = 'relative'
      this._container.appendChild(ov)
    }
    ov.textContent = msg
    ov.style.display = 'block'
  }

  _clearError() {
    const ov = this._container.querySelector('.preview-error')
    if (ov) ov.style.display = 'none'
  }
}

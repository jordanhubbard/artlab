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
 *     const { THREE, sphere, mesh, ambient, controls } = ctx
 *     ctx.add(mesh(sphere(1), { color: 0x336699 }))
 *     ctx.add(ambient(0x112244, 0.5))
 *     controls.target.set(0, 0, 0)   // optional: orbit focus
 *   }
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
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

    this._renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false })
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._renderer.setClearColor(0x0a0a12, 1)
    this._renderer.outputColorSpace = THREE.SRGBColorSpace
    this._renderer.shadowMap.enabled = true

    this._scene  = new THREE.Scene()
    this._camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100000)
    this._camera.position.set(0, 2, 6)

    // OrbitControls — enabled by default; packages can configure via ctx.controls
    this._controls = new OrbitControls(this._camera, this.canvas)
    this._controls.enableDamping  = true
    this._controls.dampingFactor  = 0.07
    this._controls.zoomSpeed      = 1.2
    this._controls.rotateSpeed    = 0.5
    this._controls.minDistance    = 0.1
    this._controls.maxDistance    = 500000

    // Idle placeholder lights (removed as soon as a module loads)
    this._idleLight = new THREE.AmbientLight(0x445566, 0.8)
    this._scene.add(this._idleLight)

    this._animationId    = null
    this._currentMod     = null
    this._ctx            = null
    this._blobUrl        = null
    this._running        = false
    this._elapsed        = 0
    this._clock          = new THREE.Clock(false)
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
    this._running    = true

    this._clearUserObjects()

    if (typeof mod.setup === 'function') {
      try {
        await mod.setup(this._ctx)
      } catch (err) {
        this._showError(`setup() threw:\n${err.message}\n${err.stack ?? ''}`)
        return
      }
    }

    this._clock.start()
  }

  async reload(pkg) { return this.run(pkg) }

  dispose() {
    this._running = false
    cancelAnimationFrame(this._animationId)
    this._unloadModule()
    this._controls.dispose()
    this._ro.disconnect()
    this._renderer.dispose()
    this.canvas.remove()
  }

  // ── Context object ──────────────────────────────────────────────────────────

  _makeContext() {
    const self  = this
    const added = []

    const ctx = {
      // ── Three.js core ───────────────────────────────────────────────────────
      THREE,
      scene:    this._scene,
      camera:   this._camera,
      renderer: this._renderer,
      /** OrbitControls instance — configure target, min/maxDistance, etc. */
      controls: this._controls,

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

      // ── Assets ──────────────────────────────────────────────────────────────
      /**
       * Load a texture from a package-relative path.
       * Resolves from in-memory assetFiles when the package is loaded as a
       * directory or zip; falls back to a plain HTTP fetch for standalone use.
       */
      loadTexture(path) {
        const bytes = self._assetFiles?.get(path)
        if (bytes) {
          const ext  = path.split('.').pop().toLowerCase()
          const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
          const url  = URL.createObjectURL(new Blob([bytes], { type: mime }))
          self._textureBlobUrls.push(url)
          return new THREE.TextureLoader().load(url)
        }
        return new THREE.TextureLoader().load(path)
      },

      // ── Time ────────────────────────────────────────────────────────────────
      elapsed: 0,

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

    this._renderer.render(this._scene, this._camera)
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
    this._clearError()

    // Restore idle light when no module is loaded
    this._scene.add(this._idleLight)
  }

  _onResize() {
    const w = this._container.clientWidth  || 400
    const h = this._container.clientHeight || 300
    this._renderer.setSize(w, h, false)
    this._camera.aspect = w / h
    this._camera.updateProjectionMatrix()
  }

  _showError(msg) {
    this._running = false
    console.error('[PreviewPane]', msg)
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

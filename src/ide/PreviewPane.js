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
import { SceneContext } from '../runtime/SceneContext.js'
import { ModuleCompiler } from './ModuleCompiler.js'

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
    const { code, dispose } = await new ModuleCompiler().compile(pkg)
    return this.runCode(code, pkg.assetFiles, dispose)
  }

  async reload(pkg) { return this.run(pkg) }

  async runCode(code, assetFiles = new Map(), cleanup = () => {}) {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    return this._startModule(() => import(/* @vite-ignore */ url), assetFiles, url, cleanup)
  }

  async runFromModule(mod) {
    return this._startModule(() => Promise.resolve(mod))
  }

  async _startModule(load, assetFiles = new Map(), url = null, cleanup = () => {}) {
    const token = this._runToken = (this._runToken ?? 0) + 1
    try {
      await this._unloadModule()
      const mod = await load()
      if (token !== this._runToken) { if (url) URL.revokeObjectURL(url); cleanup(); return }
      this._assetCleanup = cleanup
      this._assetFiles = assetFiles
      this._currentMod = mod
      this._blobUrl = url
      this._elapsed = 0
      this._clearUserObjects()
      const ctx = this._ctx = this._makeContext()
      if (typeof mod.setup !== 'function') throw new Error('The entry module must export setup(ctx). Choose a scene entry to run.')
      await mod.setup(ctx)
      if (token !== this._runToken) return
      this._running = true
      this._clock.start()
    } catch (error) {
      if (url && url !== this._blobUrl) { URL.revokeObjectURL(url); cleanup() }
      if (token === this._runToken) {
        await this._unloadModule()
        this._showError(error.message)
        throw error
      }
    }
  }

  dispose() {
    this._runToken = (this._runToken ?? 0) + 1
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
    return new SceneContext({
      scene: this._scene, camera: this._camera, renderer: this._renderer,
      controls: this._controls, labelRenderer: this._css2DRenderer,
      setBloom: (strength = 0) => { this._bloomPass.strength = Math.max(0, strength) },
      setHelp: text => {
        const element = document.getElementById('canvas-help')
        if (element) element.textContent = text == null ? '' : String(text)
      },
      loadTexture: path => {
        const bytes = this._assetFiles.get(path)
        if (!bytes) return new Three.TextureLoader().load(path)
        const url = URL.createObjectURL(new Blob([bytes]))
        this._textureBlobUrls.push(url)
        return new Three.TextureLoader().load(url)
      },
    })
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

    this._ctx?.dispose().catch(error => console.error('[PreviewPane] cleanup:', error))

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
    if (!this._currentMod) return this._unloading ?? Promise.resolve()
    this._running = false
    this._clock.stop()
    const mod = this._currentMod
    const ctx = this._ctx
    this._currentMod = null
    this._unloading = (async () => {
      try { await mod.teardown?.(ctx) } catch (error) { console.error('[PreviewPane] teardown:', error) }
      this._clearUserObjects()
      if (this._blobUrl) URL.revokeObjectURL(this._blobUrl)
      this._blobUrl = null
      this._assetCleanup?.()
      this._assetCleanup = null
      for (const url of this._textureBlobUrls) URL.revokeObjectURL(url)
      this._textureBlobUrls = []
      this._ctx = null
      const helpEl = document.getElementById('canvas-help')
      if (helpEl) helpEl.textContent = ''
      this._clearError()
      this._scene.add(this._idleLight)
    })()
    return this._unloading
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

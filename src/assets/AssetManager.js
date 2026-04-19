import * as Three from 'three'
import { ArtlabTextureLoader } from './TextureLoader.js'
import { AudioAssetLoader } from './AudioAssetLoader.js'

/**
 * AssetManager — central registry for all assets in an Artlab package.
 * Supports async loading with progress tracking and simple per-type caching.
 *
 * Usage:
 *   const mgr = new AssetManager()
 *   mgr.setPackageReader(reader)       // optional — falls back to URL loading
 *   mgr.register('textures/earth.jpg', 'texture', { fallbackColor: 0x1155aa })
 *   mgr.register('audio/ambient.ogg',  'audio')
 *   await mgr.loadAll((p) => console.log(p.loaded, '/', p.total))
 *   const tex = mgr.get('textures/earth.jpg')
 */
export class AssetManager {
  constructor() {
    this._registry         = new Map()  // path → { type, options, state, asset }
    this._cache            = new Map()  // path → asset  (LRU-capable, currently FIFO)
    this._totalBytes       = 0
    this._loadedBytes      = 0
    this._progressCallbacks = []
    this._packageReader    = null

    // Lazily-created per-type loaders
    this._textureLoader    = null
    this._audioLoader      = null
    this._audioContext     = null       // must be set via setAudioContext() for audio assets
  }

  // ── Configuration ──────────────────────────────────────────────────────────

  /**
   * Set the package reader used to load assets from a zip.
   * If not set, falls back to URL-based loading.
   * @param {import('../packages/PackageReader.js').PackageReader} reader
   */
  setPackageReader(reader) {
    this._packageReader = reader
    // Invalidate cached loaders so they pick up the new reader
    this._textureLoader = null
    this._audioLoader   = null
  }

  /**
   * Provide a Web Audio AudioContext for decoding audio assets.
   * Must be called before loadAll() if any 'audio' assets are registered.
   * AudioEngine.audioContext is the usual source.
   * @param {AudioContext} ctx
   */
  setAudioContext(ctx) {
    this._audioContext = ctx
    this._audioLoader  = null   // rebuild with new context
  }

  // ── Registration ───────────────────────────────────────────────────────────

  /**
   * Register an asset to be loaded by loadAll().
   * @param {string} path - package-relative path, e.g. 'textures/earth/daymap.jpg'
   * @param {'texture'|'audio'|'model'|'text'} type
   * @param {object} [options]
   * @param {number}  [options.fallbackColor]  hex fallback for texture type
   * @returns {AssetManager} for chaining
   */
  register(path, type, options = {}) {
    this._registry.set(path, { type, options, state: 'pending', asset: null })
    return this
  }

  // ── Bulk loading ───────────────────────────────────────────────────────────

  /**
   * Load all registered assets concurrently.
   * @param {(progress: {loaded:number, total:number, current:string}) => void} [onProgress]
   * @returns {Promise<void>}
   */
  async loadAll(onProgress) {
    if (onProgress) this._progressCallbacks.push(onProgress)

    const entries = [...this._registry.entries()].filter(
      ([, e]) => e.state === 'pending'
    )

    await Promise.all(
      entries.map(([path, entry]) => this._loadEntry(path, entry))
    )
  }

  // ── On-demand loading ──────────────────────────────────────────────────────

  /**
   * Load a single asset immediately (registers it if needed).
   * @param {string} path
   * @param {'texture'|'audio'|'model'|'text'} type
   * @param {object} [options]
   * @returns {Promise<any>}
   */
  async load(path, type, options = {}) {
    if (this._registry.has(path)) {
      const entry = this._registry.get(path)
      if (entry.state === 'loaded') return entry.asset
      if (entry.state === 'loading') {
        // Wait for in-flight load by polling (simple approach)
        return new Promise((resolve, reject) => {
          const interval = setInterval(() => {
            const e = this._registry.get(path)
            if (e.state === 'loaded')  { clearInterval(interval); resolve(e.asset) }
            if (e.state === 'error')   { clearInterval(interval); reject(new Error(`AssetManager: failed to load ${path}`)) }
          }, 50)
        })
      }
    }
    this.register(path, type, options)
    const entry = this._registry.get(path)
    await this._loadEntry(path, entry)
    return entry.asset
  }

  // ── Retrieval ──────────────────────────────────────────────────────────────

  /**
   * Get a previously-loaded asset synchronously.
   * Returns null if not yet loaded or failed.
   * @param {string} path
   * @returns {Three.Texture|AudioBuffer|string|null}
   */
  get(path) {
    const entry = this._registry.get(path)
    if (!entry || entry.state !== 'loaded') return null
    return entry.asset
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  async _loadEntry(path, entry) {
    entry.state = 'loading'
    try {
      entry.asset = await this._loadByType(path, entry.type, entry.options)
      entry.state = 'loaded'
      this._cache.set(path, entry.asset)
    } catch (err) {
      entry.state = 'error'
      console.warn(`[AssetManager] Failed to load "${path}":`, err.message)
    }
    this._emitProgress(path)
  }

  async _loadByType(path, type, options) {
    switch (type) {
      case 'texture':
        return this._getTextureLoader().loadAsync(path, options.fallbackColor)

      case 'audio':
        return this._getAudioLoader().load(path)

      case 'text': {
        if (this._packageReader) {
          const blob = await this._packageReader.readAsset(path)
          return blob.text()
        }
        const resp = await fetch(path)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        return resp.text()
      }

      case 'model':
        // Placeholder — callers can extend or handle externally
        throw new Error(`AssetManager: model loading not yet implemented for "${path}"`)

      default:
        throw new Error(`AssetManager: unknown asset type "${type}"`)
    }
  }

  _getTextureLoader() {
    if (!this._textureLoader) {
      this._textureLoader = new ArtlabTextureLoader(this._packageReader)
    }
    return this._textureLoader
  }

  _getAudioLoader() {
    if (!this._audioLoader) {
      if (!this._audioContext) {
        throw new Error('AssetManager: setAudioContext() must be called before loading audio assets')
      }
      this._audioLoader = new AudioAssetLoader(this._audioContext, this._packageReader)
    }
    return this._audioLoader
  }

  _emitProgress(current) {
    const loaded = [...this._registry.values()].filter(e => e.state === 'loaded').length
    const total  = this._registry.size
    this._progressCallbacks.forEach(cb => cb({ loaded, total, current }))
  }
}

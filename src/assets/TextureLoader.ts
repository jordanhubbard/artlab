import * as Three from 'three'
import type { AudioAssetReader as AssetReader } from './AudioAssetLoader.ts'

/**
 * ArtlabTextureLoader — loads textures from a PackageReader (zip) or by URL.
 *
 * This is the new canonical texture loader for Artlab packages. It replaces
 * src/loaders/TextureLoader.js (TextureManager) which is kept as-is for the
 * existing solar system scene. New code should use ArtlabTextureLoader.
 *
 * Features:
 * - Returns a placeholder immediately; swaps in real texture asynchronously
 * - Procedural noise fallback matches the TextureManager behavior
 * - Optional PackageReader for zip-based asset loading
 * - Used internally by AssetManager for 'texture' assets
 */
export class ArtlabTextureLoader {
  private readonly _reader: AssetReader | null
  private readonly _threeLoader: Three.TextureLoader
  private _cache = new Map<string, Three.Texture>()
  constructor(packageReader: AssetReader | null = null) {
    this._reader      = packageReader
    this._threeLoader = new Three.TextureLoader()
    this._cache       = new Map()
  }

  /**
   * Load a texture synchronously returning a placeholder that is updated async.
   * Safe to pass directly to Three material properties — the material will
   * update automatically once the real image is swapped in.
   *
   * @param {string} path  package-relative path or URL
   * @param {number} [fallbackColor=0x888888]  hex color for the placeholder
   * @returns {Three.Texture}  placeholder (real image swapped in async)
   */
  load(path: string, fallbackColor = 0x888888): Three.Texture {
    const cached = this._cache.get(path)
    if (cached) return cached

    const placeholder = this._colorTexture(fallbackColor)
    this._cache.set(path, placeholder)

    this._loadAsync(path, fallbackColor).then(tex => {
      placeholder.image = tex.image
      placeholder.needsUpdate = true
    }).catch(() => {
      // Placeholder stays as fallback — silent failure
    })

    return placeholder
  }

  /**
   * Load a texture and return a Promise that resolves to the real Three.Texture.
   * Used by AssetManager.loadAll() so callers can await full load completion.
   *
   * @param {string} path
   * @param {number} [fallbackColor=0x888888]
   * @returns {Promise<Three.Texture>}
   */
  async loadAsync(path: string, fallbackColor = 0x888888): Promise<Three.Texture> {
    const cached = this._cache.get(path)
    if (cached) return cached

    try {
      const tex = await this._loadAsync(path, fallbackColor)
      this._cache.set(path, tex)
      return tex
    } catch (err) {
      const placeholder = this._colorTexture(fallbackColor)
      this._cache.set(path, placeholder)
      return placeholder
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async _loadAsync(path: string, fallbackColor: number): Promise<Three.Texture> {
    if (this._reader) {
      const blob = await this._reader.readAsset(path)
      return this._blobToTexture(blob)
    }
    return new Promise<Three.Texture>((resolve, reject) => {
      this._threeLoader.load(path, resolve, undefined, reject)
    })
  }

  private async _blobToTexture(blob: Blob): Promise<Three.Texture> {
    const url = URL.createObjectURL(blob)
    return new Promise<Three.Texture>((resolve, reject) => {
      this._threeLoader.load(url, tex => {
        URL.revokeObjectURL(url)
        this._configureTexture(tex)
        resolve(tex)
      }, undefined, err => {
        URL.revokeObjectURL(url)
        reject(err)
      })
    })
  }

  private _configureTexture(tex: Three.Texture) {
    tex.colorSpace       = Three.SRGBColorSpace
    tex.minFilter        = Three.LinearMipmapLinearFilter
    tex.magFilter        = Three.LinearFilter
    tex.anisotropy       = 16
    tex.generateMipmaps  = true
    return tex
  }

  /**
   * Generate a canvas texture with a base color and subtle noise,
   * matching the procedural style of TextureManager._colorTexture().
   */
  private _colorTexture(hex: number, size = 256) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Texture fallback requires a 2D canvas context')

    const r = (hex >> 16) & 0xff
    const g = (hex >> 8)  & 0xff
    const b =  hex        & 0xff

    // Fill base color first so semi-transparent noise blends correctly
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, 0, size, size)

    // Subtle per-pixel noise (same chromatic weighting as TextureManager)
    const id = ctx.createImageData(size, size)
    const d  = id.data
    for (let i = 0; i < d.length; i += 4) {
      const noise = (Math.random() - 0.5) * 20
      d[i]   = Math.max(0, Math.min(255, r + noise))
      d[i+1] = Math.max(0, Math.min(255, g + noise * 0.8))
      d[i+2] = Math.max(0, Math.min(255, b + noise * 0.6))
      d[i+3] = 255
    }
    ctx.putImageData(id, 0, 0)

    const tex = new Three.CanvasTexture(canvas)
    this._configureTexture(tex)
    return tex
  }
}

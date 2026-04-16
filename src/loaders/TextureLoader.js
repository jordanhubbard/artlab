import * as THREE from 'three'

/**
 * Loads planet textures with procedural fallbacks.
 * If a texture file is missing (404), silently uses a canvas-generated placeholder
 * so the scene renders immediately without downloaded assets.
 */
export class TextureManager {
  constructor() {
    this._loader = new THREE.TextureLoader()
    this._cache  = new Map()
  }

  /**
   * Load a texture URL with a color fallback.
   * Returns immediately with the fallback, then swaps to real texture once loaded.
   * @param {string} url
   * @param {number} fallbackColor - hex color
   * @param {object} opts - { emissive, roughness }
   */
  load(url, fallbackColor = 0x888888) {
    if (this._cache.has(url)) return this._cache.get(url)

    const placeholder = this._colorTexture(fallbackColor)
    this._cache.set(url, placeholder)

    this._loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter  = THREE.LinearMipmapLinearFilter
        tex.magFilter  = THREE.LinearFilter
        tex.anisotropy = 16
        tex.generateMipmaps = true
        // Swap into cache and copy uuid so existing material refs update
        placeholder.image   = tex.image
        placeholder.needsUpdate = true
        this._cache.set(url, placeholder)
      },
      undefined,
      () => { /* silently use placeholder */ }
    )

    return placeholder
  }

  /** Generate a simple color+noise canvas texture */
  _colorTexture(hex, size = 512) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')

    const r = (hex >> 16) & 0xff
    const g = (hex >> 8)  & 0xff
    const b =  hex        & 0xff
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, 0, size, size)

    // Add procedural noise for texture variation
    const imgData = ctx.getImageData(0, 0, size, size)
    const d = imgData.data
    for (let i = 0; i < d.length; i += 4) {
      const px = (i / 4) % size
      const py = Math.floor((i / 4) / size)
      const noise = this._noise2D(px / 64, py / 64) * 30
      d[i]     = Math.min(255, Math.max(0, d[i]     + noise))
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise * 0.8))
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise * 0.6))
    }
    ctx.putImageData(imgData, 0, 0)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  _noise2D(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return (n - Math.floor(n)) * 2 - 1
  }

  /** Pre-generate all planet placeholder textures */
  preloadPlaceholders(planetDataMap) {
    for (const [, data] of Object.entries(planetDataMap)) {
      if (data.textures?.map) this.load(data.textures.map, data.color)
    }
  }
}

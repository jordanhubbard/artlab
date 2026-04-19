import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

export class ModelLoader {
  constructor() {
    this._gltfLoader = new GLTFLoader()
    this._objLoader = new OBJLoader()
    // Configure Draco for compressed GLTF
    const draco = new DRACOLoader()
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    this._gltfLoader.setDRACOLoader(draco)
    this._cache = new Map()
  }

  /**
   * Load a GLTF/GLB or OBJ from a URL — returns a Promise of THREE.Group.
   * Format is detected from the file extension (.glb, .gltf → GLTF; .obj → OBJ).
   *
   * @param {string} url
   * @param {object} [options]
   * @param {boolean} [options.castShadow=false]
   * @param {boolean} [options.receiveShadow=false]
   * @param {number}  [options.scale]  uniform scale applied after loading
   * @returns {Promise<THREE.Group>}
   */
  async loadURL(url, options = {}) {
    if (this._cache.has(url)) return this._cache.get(url).clone()

    const ext = url.split('?')[0].split('.').pop().toLowerCase()
    let group

    if (ext === 'glb' || ext === 'gltf') {
      const gltf = await this._gltfLoader.loadAsync(url)
      group = gltf.scene
    } else if (ext === 'obj') {
      group = await this._objLoader.loadAsync(url)
    } else {
      throw new Error(`ModelLoader: unsupported format ".${ext}" for URL: ${url}`)
    }

    this._applyOptions(group, options)
    this._cache.set(url, group)
    return group.clone()
  }

  /**
   * Load a model from a PackageReader zip entry.
   * Reads the binary asset, creates a temporary object URL, loads via the
   * appropriate loader, then revokes the URL to free memory.
   *
   * @param {import('../packages/PackageReader.js').PackageReader} reader
   * @param {string} path  package-relative path, e.g. 'models/ship.glb'
   * @param {object} [options]
   * @param {boolean} [options.castShadow=false]
   * @param {boolean} [options.receiveShadow=false]
   * @param {number}  [options.scale]  uniform scale applied after loading
   * @returns {Promise<THREE.Group>}
   */
  async loadPackage(reader, path, options = {}) {
    if (this._cache.has(path)) return this._cache.get(path).clone()

    const ext = path.split('?')[0].split('.').pop().toLowerCase()
    const blob = await reader.readAsset(path)
    const objectURL = URL.createObjectURL(blob)

    let group
    try {
      if (ext === 'glb' || ext === 'gltf') {
        const gltf = await this._gltfLoader.loadAsync(objectURL)
        group = gltf.scene
      } else if (ext === 'obj') {
        group = await this._objLoader.loadAsync(objectURL)
      } else {
        throw new Error(`ModelLoader: unsupported format ".${ext}" for package path: ${path}`)
      }
    } finally {
      URL.revokeObjectURL(objectURL)
    }

    this._applyOptions(group, options)
    this._cache.set(path, group)
    return group.clone()
  }

  /**
   * Center and normalize a loaded model to unit scale around the origin.
   * The model is scaled so its largest dimension equals targetSize, then
   * repositioned so its bounding-box center sits at the origin.
   *
   * @param {THREE.Group} group
   * @param {number} [targetSize=1]
   * @returns {THREE.Group}
   */
  normalize(group, targetSize = 1) {
    const box = new THREE.Box3().setFromObject(group)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    group.scale.setScalar(targetSize / maxDim)
    const center = new THREE.Vector3()
    box.getCenter(center)
    group.position.sub(center.multiplyScalar(targetSize / maxDim))
    return group
  }

  /**
   * Clear the internal cache and free all cached references.
   */
  dispose() {
    this._cache.clear()
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  _applyOptions(group, options) {
    const { castShadow = false, receiveShadow = false, scale } = options

    if (castShadow || receiveShadow) {
      group.traverse(node => {
        if (node.isMesh) {
          if (castShadow)    node.castShadow    = true
          if (receiveShadow) node.receiveShadow = true
        }
      })
    }

    if (scale != null) {
      group.scale.setScalar(scale)
    }
  }
}

export const modelLoader = new ModelLoader()

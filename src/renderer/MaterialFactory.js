import * as THREE from 'three'

/**
 * Create a Three.js material from a descriptor object.
 *
 * @param {Object} desc
 * @param {string} desc.type             - 'pbr' | 'emissive' | 'unlit' | 'custom'
 * @param {number}          [desc.color]            - hex color
 * @param {THREE.Texture}   [desc.map]              - diffuse texture
 * @param {THREE.Texture}   [desc.normalMap]        - normal map texture
 * @param {THREE.Texture}   [desc.roughnessMap]     - roughness map texture
 * @param {number}          [desc.roughness]        - 0–1
 * @param {number}          [desc.metalness]        - 0–1
 * @param {number|THREE.Color} [desc.emissive]      - emissive color (hex or Color)
 * @param {number}          [desc.emissiveIntensity]
 * @param {boolean}         [desc.transparent]
 * @param {boolean}         [desc.depthWrite]
 * @param {THREE.Side}      [desc.side]
 * @param {THREE.Blending}  [desc.blending]
 * @param {string}          [desc.vertexShader]     - for 'custom' type
 * @param {string}          [desc.fragmentShader]   - for 'custom' type
 * @param {Object}          [desc.uniforms]         - for 'custom' type
 * @returns {THREE.Material}
 */
export function createMaterial(desc) {
  if (!desc || !desc.type) {
    throw new Error('[MaterialFactory] desc.type is required')
  }

  switch (desc.type) {
    case 'pbr':
      return _makePBR(desc)

    case 'emissive':
      return _makeEmissive(desc)

    case 'unlit':
      return _makeUnlit(desc)

    case 'custom':
      return _makeCustom(desc)

    default:
      throw new Error(`[MaterialFactory] Unknown material type: "${desc.type}"`)
  }
}

// ── Material builders ─────────────────────────────────────────────────────────

/**
 * Standard physically-based material (MeshStandardMaterial).
 * Covers the pattern used by Planet.js and Moon in main.js.
 */
function _makePBR(desc) {
  const params = {}
  if (desc.color        !== undefined) params.color        = new THREE.Color(desc.color)
  if (desc.map          !== undefined) params.map          = desc.map
  if (desc.normalMap    !== undefined) params.normalMap    = desc.normalMap
  if (desc.roughnessMap !== undefined) params.roughnessMap = desc.roughnessMap
  if (desc.roughness    !== undefined) params.roughness    = desc.roughness
  if (desc.metalness    !== undefined) params.metalness    = desc.metalness
  _applyCommon(params, desc)
  return new THREE.MeshStandardMaterial(params)
}

/**
 * Emissive variant of MeshStandardMaterial.
 * Covers the pattern used by Sun.js (core sphere).
 */
function _makeEmissive(desc) {
  const params = {}
  if (desc.color             !== undefined) params.color             = new THREE.Color(desc.color)
  if (desc.map               !== undefined) params.map               = desc.map
  if (desc.roughness         !== undefined) params.roughness         = desc.roughness
  if (desc.metalness         !== undefined) params.metalness         = desc.metalness

  // emissive accepts either a hex number or a THREE.Color
  if (desc.emissive !== undefined) {
    params.emissive = desc.emissive instanceof THREE.Color
      ? desc.emissive
      : new THREE.Color(desc.emissive)
  }
  if (desc.emissiveIntensity !== undefined) params.emissiveIntensity = desc.emissiveIntensity

  _applyCommon(params, desc)
  return new THREE.MeshStandardMaterial(params)
}

/**
 * Unlit material (MeshBasicMaterial).
 */
function _makeUnlit(desc) {
  const params = {}
  if (desc.color !== undefined) params.color = new THREE.Color(desc.color)
  if (desc.map   !== undefined) params.map   = desc.map
  _applyCommon(params, desc)
  return new THREE.MeshBasicMaterial(params)
}

/**
 * Custom shader material (ShaderMaterial).
 * Covers the pattern used by Sun.js corona and Planet.js atmosphere.
 */
function _makeCustom(desc) {
  if (!desc.vertexShader || !desc.fragmentShader) {
    throw new Error('[MaterialFactory] custom type requires vertexShader and fragmentShader')
  }

  const params = {
    vertexShader:   desc.vertexShader,
    fragmentShader: desc.fragmentShader,
    uniforms:       desc.uniforms ?? {},
  }
  _applyCommon(params, desc)
  return new THREE.ShaderMaterial(params)
}

/**
 * Apply shared material properties that all types can carry.
 */
function _applyCommon(params, desc) {
  if (desc.transparent !== undefined) params.transparent = desc.transparent
  if (desc.depthWrite  !== undefined) params.depthWrite  = desc.depthWrite
  if (desc.side        !== undefined) params.side        = desc.side
  if (desc.blending    !== undefined) params.blending    = desc.blending
}

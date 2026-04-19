/**
 * artlab/geometry — Geometry stdlib for the Artlab DSL
 *
 * Factory functions that return Three.js geometry instances, plus
 * mesh() and add() helpers for quick scene assembly.
 */

import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Geometry factories
// ---------------------------------------------------------------------------

/** Sphere geometry. */
export function sphere(radius = 1, detail = 32) {
  return new THREE.SphereGeometry(radius, detail, detail)
}

/** Box geometry. */
export function box(w = 1, h = 1, d = 1) {
  return new THREE.BoxGeometry(w, h, d)
}

/** Cylinder geometry (top radius, bottom radius, height, segments). */
export function cylinder(rt = 1, rb = 1, h = 2, segs = 32) {
  return new THREE.CylinderGeometry(rt, rb, h, segs)
}

/** Torus geometry (major radius, tube radius, tubular segments, radial segments). */
export function torus(R = 1, r = 0.3, ts = 64, rs = 16) {
  return new THREE.TorusGeometry(R, r, rs, ts)
}

/** Plane geometry. */
export function plane(w = 1, h = 1, ws = 1, hs = 1) {
  return new THREE.PlaneGeometry(w, h, ws, hs)
}

/** Ring geometry (inner radius, outer radius, segments). */
export function ring(iR = 0.5, oR = 1, segs = 64) {
  return new THREE.RingGeometry(iR, oR, segs)
}

/** Cone geometry (radius, height, segments). */
export function cone(r = 1, h = 2, segs = 32) {
  return new THREE.ConeGeometry(r, h, segs)
}

// ---------------------------------------------------------------------------
// Mesh helpers
// ---------------------------------------------------------------------------

const _loader = new THREE.TextureLoader()
function _tex(v) { return typeof v === 'string' ? _loader.load(v) : v }

const _SIDE = { front: THREE.FrontSide, back: THREE.BackSide, double: THREE.DoubleSide }

/**
 * Wrap a geometry in a MeshStandardMaterial mesh.
 *
 * options support all common MeshStandardMaterial properties:
 *   color, roughness, metalness, wireframe, transparent, opacity,
 *   side ('front'|'back'|'double' or THREE constant),
 *   emissive (hex), emissiveIntensity, emissiveMap, map, alphaMap,
 *   normalMap, roughnessMap, metalnessMap, depthWrite, blending
 *
 * Texture properties accept a URL string or a THREE.Texture instance.
 */
export function mesh(geometry, options = {}) {
  const {
    color = 0xffffff, roughness = 0.7, metalness = 0.0, wireframe = false,
    transparent, opacity, side, depthWrite, blending,
    emissive, emissiveIntensity,
    map, emissiveMap, alphaMap, normalMap, roughnessMap, metalnessMap,
    ...rest
  } = options

  const matOpts = { color, roughness, metalness, wireframe, ...rest }

  if (transparent !== undefined)      matOpts.transparent      = transparent
  if (opacity     !== undefined)      matOpts.opacity          = opacity
  if (depthWrite  !== undefined)      matOpts.depthWrite       = depthWrite
  if (blending    !== undefined)      matOpts.blending         = blending
  if (emissiveIntensity !== undefined) matOpts.emissiveIntensity = emissiveIntensity

  if (side !== undefined)
    matOpts.side = (typeof side === 'string') ? (_SIDE[side] ?? THREE.FrontSide) : side

  if (emissive !== undefined)
    matOpts.emissive = (typeof emissive === 'number') ? new THREE.Color(emissive) : emissive

  if (map          !== undefined) matOpts.map          = _tex(map)
  if (emissiveMap  !== undefined) matOpts.emissiveMap  = _tex(emissiveMap)
  if (alphaMap     !== undefined) matOpts.alphaMap     = _tex(alphaMap)
  if (normalMap    !== undefined) matOpts.normalMap    = _tex(normalMap)
  if (roughnessMap !== undefined) matOpts.roughnessMap = _tex(roughnessMap)
  if (metalnessMap !== undefined) matOpts.metalnessMap = _tex(metalnessMap)

  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial(matOpts))
}

/**
 * Create a mesh from geometry and immediately add it to scene.
 * Returns the mesh for further manipulation.
 */
export function add(scene, geometry, options = {}) {
  const m = mesh(geometry, options)
  scene.add(m)
  return m
}

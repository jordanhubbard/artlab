/** artlab/math — Math stdlib for the Artlab DSL */

export { Vector2, Vector3, Vector4, Matrix3, Matrix4, Quaternion, MathUtils } from 'three'
export { Vector2 as Vec2, Vector3 as Vec3, Vector4 as Vec4 } from 'three'
export { Matrix3 as Mat3, Matrix4 as Mat4 } from 'three'
export { Quaternion as Quat } from 'three'

// --- Unit conversion --------------------------------------------------------

export const DEG_TO_RAD = Math.PI / 180
export const RAD_TO_DEG = 180 / Math.PI

/** Convert radians to degrees. */
export function deg(r) { return r * RAD_TO_DEG }
/** Convert degrees to radians. */
export function rad(d) { return d * DEG_TO_RAD }

// --- Core math helpers ------------------------------------------------------

/** Clamp v to [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v
}

/** Linear interpolation from a to b by t. */
export function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Re-map v from [inMin, inMax] to [outMin, outMax].
 * Does not clamp the output.
 */
export function map(v, inMin, inMax, outMin, outMax) {
  return outMin + (outMax - outMin) * ((v - inMin) / (inMax - inMin))
}

/** GLSL-style smoothstep. */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

// --- Easing functions (t ∈ [0,1] → [0,1]) -----------------------------------

/** Quadratic ease-in. */
export function easeIn(t) {
  return t * t
}

/** Quadratic ease-out. */
export function easeOut(t) {
  return t * (2 - t)
}

/** Quadratic ease-in-out. */
export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

/** Elastic ease-out (one overshoot). */
export function elasticOut(t) {
  if (t === 0 || t === 1) return t
  const p = 0.3
  return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1
}

/** Bounce ease-out. */
export function bounceOut(t) {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t
  } else if (t < 2 / 2.75) {
    t -= 1.5 / 2.75
    return 7.5625 * t * t + 0.75
  } else if (t < 2.5 / 2.75) {
    t -= 2.25 / 2.75
    return 7.5625 * t * t + 0.9375
  } else {
    t -= 2.625 / 2.75
    return 7.5625 * t * t + 0.984375
  }
}

// --- Value noise (permutation-table, no external deps) ----------------------

// 512-entry permutation table, built once at module load.
const _perm = (() => {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  // Fisher-Yates shuffle, fixed seed for reproducibility
  let seed = 42
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0x100000000 }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]]
  }
  const perm = new Uint8Array(512) // doubled to avoid index wrapping
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  return perm
})()

function _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }

function _grad2(hash, x, y) {
  const h = hash & 3
  const u = h < 2 ? x : y
  const v = h < 2 ? y : x
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v)
}

function _grad3(hash, x, y, z) {
  const h = hash & 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z)
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v)
}

/** Classic Perlin-style noise for 2D input. Returns [-1, 1]. */
export function noise2(x, y) {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  x -= Math.floor(x)
  y -= Math.floor(y)
  const u = _fade(x)
  const v = _fade(y)
  const a  = _perm[X] + Y
  const aa = _perm[a]
  const ab = _perm[a + 1]
  const b  = _perm[X + 1] + Y
  const ba = _perm[b]
  const bb = _perm[b + 1]
  return lerp(
    lerp(_grad2(_perm[aa], x,     y    ), _grad2(_perm[ba], x - 1, y    ), u),
    lerp(_grad2(_perm[ab], x,     y - 1), _grad2(_perm[bb], x - 1, y - 1), u),
    v,
  )
}

/** Classic Perlin-style noise for 3D input. Returns [-1, 1]. */
export function noise3(x, y, z) {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const Z = Math.floor(z) & 255
  x -= Math.floor(x)
  y -= Math.floor(y)
  z -= Math.floor(z)
  const u = _fade(x)
  const v = _fade(y)
  const w = _fade(z)
  const a   = _perm[X] + Y
  const aa  = _perm[a] + Z
  const ab  = _perm[a + 1] + Z
  const b   = _perm[X + 1] + Y
  const ba  = _perm[b] + Z
  const bb  = _perm[b + 1] + Z
  return lerp(
    lerp(
      lerp(_grad3(_perm[aa],     x,     y,     z    ), _grad3(_perm[ba],     x - 1, y,     z    ), u),
      lerp(_grad3(_perm[ab],     x,     y - 1, z    ), _grad3(_perm[bb],     x - 1, y - 1, z    ), u),
      v,
    ),
    lerp(
      lerp(_grad3(_perm[aa + 1], x,     y,     z - 1), _grad3(_perm[ba + 1], x - 1, y,     z - 1), u),
      lerp(_grad3(_perm[ab + 1], x,     y - 1, z - 1), _grad3(_perm[bb + 1], x - 1, y - 1, z - 1), u),
      v,
    ),
    w,
  )
}

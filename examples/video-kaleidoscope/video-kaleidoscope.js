// Video Kaleidoscope — live webcam with real-time kaleidoscope GLSL shader.
// Press K to cycle symmetry segments (3 → 4 → 6 → 8 → 12 → 3...)
// Press R to reset the accumulated rotation offset.

import * as Three from 'three'
import { webcam } from '../../src/stdlib/video.js'

// ── Constants ────────────────────────────────────────────────────────────────

const SEGMENTS = [3, 4, 6, 8, 12]

// Camera sits at z=9, FOV 60 — compute a plane that exactly fills the view.
const FOV_RAD  = 60 * Math.PI / 180
const CAM_DIST = 9
const PLANE_H  = 2 * Math.tan(FOV_RAD / 2) * CAM_DIST  // ≈ 10.39
const PLANE_W  = PLANE_H * (16 / 9)                     // ≈ 18.47

// ── Shader ───────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */`
  uniform sampler2D map;
  uniform float     time;
  uniform float     segments;
  varying vec2      vUv;

  const float PI = 3.14159265358979;

  void main() {
    // Centered coordinates
    vec2 p = vUv - 0.5;

    // Polar
    float r     = length(p);
    float theta = atan(p.y, p.x);

    // Slow continuous rotation
    theta += time * 0.08;

    // Fold into first sector
    float sector = PI / segments;
    theta = mod(theta, sector * 2.0);
    if (theta > sector) theta = sector * 2.0 - theta;

    // Back to Cartesian UV
    vec2 uv = vec2(cos(theta), sin(theta)) * r + 0.5;
    uv = clamp(uv, 0.0, 1.0);

    vec4 col = texture2D(map, uv);

    // Mild saturation boost — push toward vivid by pulling away from grey
    float grey = dot(col.rgb, vec3(0.299, 0.587, 0.114));
    col.rgb = mix(vec3(grey), col.rgb, 1.35);

    gl_FragColor = col;
  }
`

// ── Module state ─────────────────────────────────────────────────────────────

let _cam, _mesh, _mat
let _segIdx  = 0
let _hud, _onKey

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export async function setup(ctx) {
  ctx.camera.position.set(0, 0, CAM_DIST)
  ctx.camera.fov    = 60
  ctx.camera.aspect = PLANE_W / PLANE_H
  ctx.camera.updateProjectionMatrix()

  const container = ctx.renderer.domElement.parentElement
  container.style.position = 'relative'

  // Require a user gesture before requesting camera access
  await _awaitGesture(container)

  _cam = webcam({ width: 1280, height: 720 })

  _mat = new Three.ShaderMaterial({
    uniforms: {
      map:      { value: _cam.texture },
      time:     { value: 0 },
      segments: { value: SEGMENTS[_segIdx] },
    },
    vertexShader:   VERT,
    fragmentShader: FRAG,
    side: Three.DoubleSide,
  })

  const geo = new Three.PlaneGeometry(PLANE_W, PLANE_H)
  _mesh = new Three.Mesh(geo, _mat)
  ctx.add(_mesh)

  _hud = _buildHud(container)
  _updateHud()

  _onKey = e => {
    const k = e.key.toLowerCase()
    if (k === 'k') {
      _segIdx = (_segIdx + 1) % SEGMENTS.length
      _mat.uniforms.segments.value = SEGMENTS[_segIdx]
      _updateHud()
    }
    if (k === 'r') {
      // Reset by zeroing the time-driven rotation — we achieve this by
      // snapping to zero: store an offset and subtract it in update().
      _rotOffset = _mat.uniforms.time.value
      _updateHud()
    }
  }
  window.addEventListener('keydown', _onKey)
}

let _rotOffset = 0

export function update(ctx /*, dt */) {
  if (_mat) {
    _mat.uniforms.time.value = ctx.elapsed - _rotOffset
  }
}

export function teardown(ctx) {
  _cam?.stop()
  window.removeEventListener('keydown', _onKey)
  _hud?.remove()
  _cam = null
  _mesh = null
  _mat  = null
  _hud  = null
  _onKey = null
  _segIdx = 0
  _rotOffset = 0
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _awaitGesture(container) {
  return new Promise(resolve => {
    const btn = document.createElement('button')
    Object.assign(btn.style, {
      position:    'absolute',
      bottom:      '50%',
      left:        '50%',
      transform:   'translate(-50%, 50%)',
      background:  'rgba(10,12,30,0.92)',
      border:      '1px solid rgba(120,180,255,0.45)',
      color:       '#aaddff',
      padding:     '14px 44px',
      cursor:      'pointer',
      fontSize:    '13px',
      borderRadius:'4px',
      zIndex:      '100',
      fontFamily:  'monospace',
      letterSpacing: '0.22em',
    })
    btn.textContent = 'Allow Camera'
    container.appendChild(btn)
    btn.addEventListener('click', () => { btn.remove(); resolve() }, { once: true })
  })
}

function _buildHud(container) {
  const el = document.createElement('div')
  Object.assign(el.style, {
    position:      'absolute',
    bottom:        '28px',
    left:          '22px',
    zIndex:        '50',
    color:         '#556677',
    font:          '11px/2 monospace',
    letterSpacing: '0.13em',
    pointerEvents: 'none',
  })
  container.appendChild(el)
  return el
}

function _updateHud() {
  if (!_hud) return
  _hud.innerHTML =
    `<div style="color:#99bbcc;font-size:13px">${SEGMENTS[_segIdx]}&times; symmetry</div>` +
    `<div>K &mdash; change &middot; R &mdash; reset rotation</div>`
}

// Export internals needed by tests
export { _segIdx as __segIdx, SEGMENTS as __SEGMENTS }

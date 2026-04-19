// Video FX Lab — webcam with four clearly-visible real-time shader effects.
// Panels: Raw | Pixelate | Glitch | Edge Detection
// Press G to toggle heavy glitch mode, P to bump pixelation up/down.

import * as Three from 'three'
import { webcam, captureCanvas } from '../../src/stdlib/video.js'

const W = 5.0, H = W * (9 / 16)

const POSITIONS = [
  new Three.Vector3(-W / 2 - 0.12,  H / 2 + 0.12, 0),
  new Three.Vector3( W / 2 + 0.12,  H / 2 + 0.12, 0),
  new Three.Vector3(-W / 2 - 0.12, -H / 2 - 0.12, 0),
  new Three.Vector3( W / 2 + 0.12, -H / 2 - 0.12, 0),
]

const LABELS = ['RAW', 'PIXELATE', 'GLITCH', 'EDGES']

// ── Shader materials ────────────────────────────────────────────────────────

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }
`

function makePixelate(tex) {
  return new Three.ShaderMaterial({
    uniforms: {
      map:       { value: tex },
      blockSize: { value: 16.0 },
      res:       { value: new Three.Vector2(1280, 720) },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D map;
      uniform float     blockSize;
      uniform vec2      res;
      varying vec2      vUv;
      void main() {
        vec2 snapped = (floor(vUv * res / blockSize) * blockSize + blockSize * .5) / res;
        gl_FragColor = texture2D(map, snapped);
      }
    `,
    side: Three.DoubleSide,
  })
}

function makeGlitch(tex) {
  return new Three.ShaderMaterial({
    uniforms: {
      map:       { value: tex },
      intensity: { value: 0.04 },
      time:      { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D map;
      uniform float     intensity;
      uniform float     time;
      varying vec2      vUv;

      float rand(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
      }
      void main() {
        float t = time;
        // Horizontal scanline shift
        float rowNoise = rand(vec2(floor(vUv.y * 60.0 + t * 4.0), t));
        float shift = rowNoise * intensity * step(0.7, rand(vec2(floor(vUv.y * 12.0), t)));

        // RGB channel separation
        float r = texture2D(map, vUv + vec2( shift * 1.5, 0.)).r;
        float g = texture2D(map, vUv                       ).g;
        float b = texture2D(map, vUv - vec2( shift * 1.5, 0.)).b;

        // Scanlines
        float scan = 0.82 + 0.18 * sin(vUv.y * 600.0 - t * 30.0);

        // Occasional full-line displacement
        float jumpY = floor(vUv.y * 20.0 + t);
        float lineShift = (rand(vec2(jumpY, t * 0.3)) - 0.5) * intensity * 3.0
                          * step(0.93, rand(vec2(jumpY * 0.7, t)));
        vec4 jumped = texture2D(map, vec2(vUv.x + lineShift, vUv.y));

        float glitchMix = step(0.97, rand(vec2(jumpY, t + 0.1)));
        vec4 col = mix(vec4(r, g, b, 1.0), jumped, glitchMix) * scan;
        gl_FragColor = col;
      }
    `,
    side: Three.DoubleSide,
  })
}

function makeEdge(tex) {
  return new Three.ShaderMaterial({
    uniforms: {
      map:  { value: tex },
      res:  { value: new Three.Vector2(1280, 720) },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D map;
      uniform vec2      res;
      varying vec2      vUv;

      float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

      void main() {
        vec2 px = 1.0 / res;
        float tl = luma(texture2D(map, vUv + vec2(-px.x,  px.y)).rgb);
        float tc = luma(texture2D(map, vUv + vec2( 0.,    px.y)).rgb);
        float tr = luma(texture2D(map, vUv + vec2( px.x,  px.y)).rgb);
        float cl = luma(texture2D(map, vUv + vec2(-px.x,  0.  )).rgb);
        float cr = luma(texture2D(map, vUv + vec2( px.x,  0.  )).rgb);
        float bl = luma(texture2D(map, vUv + vec2(-px.x, -px.y)).rgb);
        float bc = luma(texture2D(map, vUv + vec2( 0.,   -px.y)).rgb);
        float br = luma(texture2D(map, vUv + vec2( px.x, -px.y)).rgb);

        float Gx = -tl - 2.*cl - bl + tr + 2.*cr + br;
        float Gy = -tl - 2.*tc - tr + bl + 2.*bc + br;
        float edge = clamp(sqrt(Gx*Gx + Gy*Gy) * 4.0, 0., 1.);

        // Edge glow: electric blue on dark
        vec3 glow = mix(vec3(0.02, 0.03, 0.08), vec3(0.3, 0.8, 1.0), edge);
        gl_FragColor = vec4(glow, 1.0);
      }
    `,
    side: Three.DoubleSide,
  })
}

// ── State ────────────────────────────────────────────────────────────────────

let _cam, _planes, _labels, _glitchMat, _pixMat, _recorder
let _recording = false, _glitchHeavy = false, _pixLevel = 0
let _hud, _onKey

const PIX_LEVELS = [6, 12, 24, 48]

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export async function setup(ctx) {
  ctx.camera.position.set(0, 0, 11)
  ctx.setBloom(0.2)

  ctx.add(new Three.AmbientLight(0x112233, 1.0))

  // Allow Camera gesture
  await _awaitGesture(ctx.renderer.domElement.parentElement)
  _cam = webcam({ width: 1280, height: 720 })
  const tex = _cam.texture

  // Effect materials
  const rawMat  = new Three.MeshBasicMaterial({ map: tex, side: Three.DoubleSide })
  _pixMat       = makePixelate(tex)
  _glitchMat    = makeGlitch(tex)
  const edgeMat = makeEdge(tex)

  const materials = [rawMat, _pixMat, _glitchMat, edgeMat]

  // Build 4 planes with edge frames and DOM labels
  const planeGeo = new Three.PlaneGeometry(W, H)
  const frameGeo = new Three.EdgesGeometry(new Three.PlaneGeometry(W, H))
  _planes = []
  _labels = []

  const container = ctx.renderer.domElement.parentElement
  container.style.position = 'relative'

  POSITIONS.forEach((pos, i) => {
    const mesh = new Three.Mesh(planeGeo, materials[i])
    mesh.position.copy(pos)
    ctx.add(mesh)
    _planes.push(mesh)

    const frame = new Three.LineSegments(
      frameGeo,
      new Three.LineBasicMaterial({ color: 0x2255aa })
    )
    frame.position.copy(pos)
    ctx.add(frame)

    // DOM label positioned relative to canvas container
    const lbl = document.createElement('div')
    lbl.textContent = LABELS[i]
    Object.assign(lbl.style, {
      position: 'absolute',
      background: 'rgba(4,6,18,0.82)',
      border: '1px solid rgba(60,100,200,0.4)',
      color: '#4488bb',
      font: '9px/1 monospace',
      letterSpacing: '.15em',
      padding: '3px 8px',
      pointerEvents: 'none',
      zIndex: '5',
    })
    container.appendChild(lbl)
    _labels.push({ el: lbl, pos3d: new Three.Vector3(pos.x, pos.y - H / 2 - 0.22, 0) })
  })

  _recorder = captureCanvas(ctx.renderer.domElement, { fps: 30 })
  _hud = _buildHud(container)

  _onKey = e => {
    const k = e.key.toLowerCase()
    if (k === 'r') {
      if (!_recording) { _recorder.start(); _recording = true }
      else { _recorder.stop(); _recording = false; setTimeout(() => _recorder.download('artlab.webm'), 200) }
      _updateHud()
    }
    if (k === 'g') {
      _glitchHeavy = !_glitchHeavy
      if (_glitchMat) _glitchMat.uniforms.intensity.value = _glitchHeavy ? 0.12 : 0.04
      _updateHud()
    }
    if (k === 'p') {
      _pixLevel = (_pixLevel + 1) % PIX_LEVELS.length
      _updateHud()
    }
  }
  window.addEventListener('keydown', _onKey)
}

export function update(ctx, dt) {
  if (_glitchMat) _glitchMat.uniforms.time.value = ctx.elapsed

  // Animate pixelation level
  if (_pixMat) {
    const base = PIX_LEVELS[_pixLevel]
    _pixMat.uniforms.blockSize.value = base + Math.sin(ctx.elapsed * 0.8) * (base * 0.4)
  }

  // Gentle float
  _planes?.forEach((p, i) => {
    p.position.y = POSITIONS[i].y + Math.sin(ctx.elapsed * 0.35 + i * 1.1) * 0.06
  })

  // Update DOM label positions from 3D coords
  if (_labels) {
    const container = ctx.renderer.domElement.parentElement
    const cRect = container.getBoundingClientRect()
    for (const { el, pos3d } of _labels) {
      const p = pos3d.clone().project(ctx.camera)
      const x = (p.x * 0.5 + 0.5) * cRect.width
      const y = (-p.y * 0.5 + 0.5) * cRect.height
      el.style.left = (x - el.offsetWidth / 2) + 'px'
      el.style.top  = y + 'px'
    }
  }
}

export function teardown(ctx) {
  if (_recording) _recorder?.stop()
  _cam?.stop()
  window.removeEventListener('keydown', _onKey)
  _hud?.remove()
  for (const { el } of (_labels || [])) el.remove()
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _awaitGesture(container) {
  return new Promise(resolve => {
    let btn = container.querySelector('#start-btn')
    if (!btn) {
      btn = document.createElement('button')
      btn.id = 'start-btn'
      Object.assign(btn.style, {
        position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(10,15,40,0.9)', border: '1px solid rgba(100,170,255,0.5)',
        color: '#aaddff', padding: '12px 40px', cursor: 'pointer', fontSize: '12px',
        borderRadius: '3px', zIndex: '100', fontFamily: 'monospace',
        letterSpacing: '0.25em',
      })
      container.appendChild(btn)
    }
    btn.textContent = 'Allow Camera'
    btn.style.display = 'block'
    btn.addEventListener('click', () => { btn.style.display = 'none'; resolve() }, { once: true })
  })
}

function _buildHud(container) {
  const el = document.createElement('div')
  Object.assign(el.style, {
    position: 'absolute', bottom: '36px', left: '24px', zIndex: '50',
    color: '#445566', font: '10px/1.9 monospace', letterSpacing: '.12em',
    pointerEvents: 'none',
  })
  _updateHud(el)
  container.appendChild(el)
  return el
}

function _updateHud(el = _hud) {
  if (!el) return
  el.innerHTML =
    `<div style="color:${_recording ? '#ff4444' : '#334455'}">${_recording ? '● REC' : '○ REC'}</div>` +
    `<div>R — record/stop</div>` +
    `<div>G — glitch ${_glitchHeavy ? '[HEAVY]' : '[normal]'}</div>` +
    `<div>P — pixelate ${PIX_LEVELS[_pixLevel]}px</div>`
}

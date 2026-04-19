// Video FX Lab — demonstrates stdlib/video: webcam, pixelate, glitch, chromaKey, captureCanvas

import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { webcam, pixelate, glitch, chromaKey, captureCanvas } from '../../src/stdlib/video.js'

// Plane dims: 16:9
const W = 5.2, H = W * (9 / 16)

// Layout: 2×2 grid, slight gap
const POSITIONS = [
  new THREE.Vector3(-W / 2 - 0.15,  H / 2 + 0.15, 0),   // top-left:     raw
  new THREE.Vector3( W / 2 + 0.15,  H / 2 + 0.15, 0),   // top-right:    pixelate
  new THREE.Vector3(-W / 2 - 0.15, -H / 2 - 0.15, 0),   // bottom-left:  glitch
  new THREE.Vector3( W / 2 + 0.15, -H / 2 - 0.15, 0),   // bottom-right: chroma key
]
const LABELS = ['RAW', 'PIXELATE', 'GLITCH', 'CHROMA KEY']

let _cam, _planes, _glitchMat, _pixMat, _recorder
let _recording = false, _pixBlock = 8, _glitchHigh = false
let _hud, _onKey, _labelRenderer2

export async function setup(ctx) {
  ctx.camera.position.set(0, 0, 11)
  ctx.setBloom(0.35)

  ctx.add(new THREE.AmbientLight(0x112233, 1.2))

  // Deep space background
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 30),
    new THREE.MeshBasicMaterial({ color: 0x000308 })
  )
  bg.position.z = -1
  ctx.add(bg)

  // Subtle starfield
  const stars = new Float32Array(600)
  for (let i = 0; i < 600; i++) stars[i] = (Math.random() - 0.5) * 30
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(stars, 3))
  ctx.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x445566, size: 0.04 })))

  // Webcam — prompt user gesture first
  await _awaitGesture(ctx)
  _cam = webcam({ width: 1280, height: 720 })
  const tex = _cam.texture

  // Four effect materials
  const rawMat   = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
  _pixMat        = pixelate(tex, _pixBlock)
  _glitchMat     = glitch(tex, { intensity: 0.012, speed: 1.2 })
  const chromaMat = chromaKey(tex, new THREE.Color(0, 0.85, 0.1), 0.38)

  const materials = [rawMat, _pixMat, _glitchMat, chromaMat]

  // Build planes + border frames + CSS2D labels
  const planeGeo = new THREE.PlaneGeometry(W, H)
  const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(W, H))
  _planes = []

  POSITIONS.forEach((pos, i) => {
    const mesh = new THREE.Mesh(planeGeo, materials[i])
    mesh.position.copy(pos)
    ctx.add(mesh)
    _planes.push(mesh)

    const frame = new THREE.LineSegments(
      frameGeo,
      new THREE.LineBasicMaterial({ color: i === 0 ? 0x223344 : 0x2255aa })
    )
    frame.position.copy(pos)
    ctx.add(frame)

    // Label below each plane
    const div = document.createElement('div')
    div.textContent = LABELS[i]
    div.style.cssText = 'color:#4488bb;font:9px/1 monospace;letter-spacing:.18em;pointer-events:none'
    const label = new CSS2DObject(div)
    label.position.set(pos.x, pos.y - H / 2 - 0.18, 0)
    ctx.scene.add(label)
  })

  // Canvas recorder wired to the renderer's canvas
  _recorder = captureCanvas(ctx.renderer.domElement, { fps: 30 })

  _hud = _buildHud()
  _onKey = e => _handleKey(e.key.toLowerCase(), ctx, tex)
  window.addEventListener('keydown', _onKey)
}

export function update(ctx, dt) {
  // Advance glitch time uniform
  if (_glitchMat) _glitchMat.uniforms.time.value = ctx.elapsed

  // Animate pixelate block size: 4→24→4, period 8s
  if (_pixMat) {
    const t = (Math.sin(ctx.elapsed * Math.PI / 4) * 0.5 + 0.5)
    _pixMat.uniforms.blockSize.value = 4 + t * 20
  }

  // Subtle float on each plane
  _planes?.forEach((p, i) => {
    p.position.y = POSITIONS[i].y + Math.sin(ctx.elapsed * 0.4 + i * 1.2) * 0.06
  })

  // Update recording status in HUD
  if (_hud && _cam) {
    const status = _recording ? '● REC' : '○ REC'
    _hud.querySelector('#status').textContent = status
  }
}

export function teardown(ctx) {
  if (_recording) _recorder?.stop()
  _cam?.stop()
  window.removeEventListener('keydown', _onKey)
  _hud?.remove()
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _awaitGesture(ctx) {
  return new Promise(resolve => {
    let btn = document.getElementById('start-btn')
    if (!btn) {
      btn = document.createElement('button')
      btn.id = 'start-btn'
      Object.assign(btn.style, {
        position: 'fixed', bottom: '48px', left: '50%', transform: 'translateX(-50%)',
        background: 'transparent', border: '1px solid rgba(100,170,255,0.4)',
        color: '#aaddff', padding: '14px 44px', cursor: 'pointer', fontSize: '12px',
        borderRadius: '2px', zIndex: '50', fontFamily: 'monospace',
        letterSpacing: '0.3em', textTransform: 'uppercase',
      })
      document.body.appendChild(btn)
    }
    btn.textContent = 'Allow Camera'
    btn.style.display = 'block'
    btn.addEventListener('click', () => { btn.style.display = 'none'; resolve() }, { once: true })
  })
}

function _buildHud() {
  const el = document.createElement('div')
  el.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:24px', 'z-index:50',
    'color:#445566', 'font:10px/1.8 monospace', 'letter-spacing:.15em',
    'pointer-events:none',
  ].join(';')
  el.innerHTML = `
    <div id="status">○ REC</div>
    <div>R — record / stop+save</div>
    <div>G — toggle glitch intensity</div>
  `
  document.body.appendChild(el)
  return el
}

function _handleKey(key, ctx, tex) {
  if (key === 'r') {
    if (!_recording) { _recorder.start(); _recording = true }
    else { _recorder.stop(); _recording = false; setTimeout(() => _recorder.download('artlab-capture.webm'), 200) }
  }
  if (key === 'g') {
    _glitchHigh = !_glitchHigh
    if (_glitchMat) _glitchMat.uniforms.intensity.value = _glitchHigh ? 0.045 : 0.012
  }
}

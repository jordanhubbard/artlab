// Video Broadcast — live webcam with broadcast-quality DOM overlays.
// Lower-third slides in after 1.5s · scrolling ticker · pulsing LIVE badge

import * as Three from 'three'
import { webcam } from '../../src/stdlib/video.js'

// ── Ticker content ────────────────────────────────────────────────────────────

const TICKER_TOPICS = [
  'WebGPU shaders',
  'generative art',
  'Three.js geometry',
  'audio-reactive visuals',
  'GLSL fragment shaders',
  'particle systems',
  'ray marching',
  'creative coding',
  'procedural textures',
  'real-time video FX',
  'compute pipelines',
  'signed distance fields',
  'instanced meshes',
  'postprocessing bloom',
  'Fourier transforms',
]

const TICKER_TEXT = TICKER_TOPICS.join('  ·  ')
const TICKER_PX_PER_CHAR = 7.5          // approximate width at 11px monospace
const TICKER_TEXT_WIDTH = TICKER_TEXT.length * TICKER_PX_PER_CHAR
const TICKER_SPEED = 80                  // px / sec

// ── Module-level state ────────────────────────────────────────────────────────

let _cam, _mesh
let _overlay, _liveBadge, _liveDot, _lowerThird, _ticker, _branding
let _lowerThirdIn = false
let _lowerThirdT = 0          // animation progress [0, 1]
let _lowerThirdVisible = false
let _tickerX = 0
let _startTime = 0

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export async function setup(ctx) {
  const container = ctx.renderer.domElement.parentElement

  // Camera is set back enough to frame a 16:9 plane snugly
  ctx.camera.position.set(0, 0, 9)
  ctx.camera.fov = 60
  ctx.camera.updateProjectionMatrix()
  ctx.setBloom(0)

  // --- Start button (user gesture required for getUserMedia) ---
  await _awaitGesture(container)

  // --- Webcam ---
  _cam = webcam({ width: 1280, height: 720 })

  // 16:9 plane fills the view
  const geo = new Three.PlaneGeometry(16, 9)
  const mat = new Three.MeshBasicMaterial({ map: _cam.texture, side: Three.DoubleSide })
  _mesh = new Three.Mesh(geo, mat)
  ctx.add(_mesh)

  // --- DOM overlay (positioned absolutely inside container) ---
  _overlay = document.createElement('div')
  Object.assign(_overlay.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: '10',
  })
  container.appendChild(_overlay)

  _buildLiveBadge()
  _buildCornerBranding()
  _buildLowerThird()
  _buildTicker()

  _startTime = performance.now() / 1000
  _lowerThirdVisible = false
  _lowerThirdT = 0
  _tickerX = 0
}

export function update(ctx, dt) {
  const elapsed = ctx.elapsed

  // ── Pulsing LIVE dot ──────────────────────────────────────────────────────
  if (_liveDot) {
    const pulse = 0.55 + 0.45 * Math.sin(elapsed * 3.2)
    _liveDot.style.opacity = String(pulse)
  }

  // ── Lower-third slide-in after 1.5 s ─────────────────────────────────────
  if (!_lowerThirdVisible && elapsed >= 1.5) {
    _lowerThirdVisible = true
  }
  if (_lowerThirdVisible && _lowerThirdT < 1) {
    _lowerThirdT = Math.min(1, _lowerThirdT + dt / 0.6)     // 0.6 s slide
    const ease = 1 - Math.pow(1 - _lowerThirdT, 3)          // cubic ease-out
    const xPct = (1 - ease) * -110                           // -110% → 0%
    if (_lowerThird) _lowerThird.style.transform = `translateX(${xPct}%)`
  }

  // ── Scrolling ticker ──────────────────────────────────────────────────────
  if (_ticker) {
    _tickerX -= TICKER_SPEED * dt
    if (_tickerX < -TICKER_TEXT_WIDTH) _tickerX = 0
    _ticker.style.transform = `translateX(${_tickerX}px)`
  }
}

export function teardown(ctx) {
  _cam?.stop()
  _overlay?.remove()
  _overlay = null
  _liveBadge = null
  _liveDot = null
  _lowerThird = null
  _ticker = null
  _branding = null
  _mesh = null
  _cam = null

  // Remove the gesture button if the user switched examples before clicking it.
  ctx.renderer.domElement.parentElement?.querySelector('#vb-start-btn')?.remove()
}

// ── Builder helpers ───────────────────────────────────────────────────────────

function _buildLiveBadge() {
  _liveBadge = document.createElement('div')
  Object.assign(_liveBadge.style, {
    position: 'absolute',
    top: '14px',
    right: '18px',
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    background: 'rgba(10,10,10,0.72)',
    border: '1px solid rgba(255,60,60,0.55)',
    borderRadius: '3px',
    padding: '5px 11px 5px 8px',
    fontFamily: 'monospace',
    fontSize: '11px',
    letterSpacing: '0.22em',
    color: '#ff4444',
    fontWeight: 'bold',
  })

  _liveDot = document.createElement('div')
  Object.assign(_liveDot.style, {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    background: '#ff2222',
    flexShrink: '0',
  })

  const label = document.createElement('span')
  label.textContent = 'LIVE'

  _liveBadge.appendChild(_liveDot)
  _liveBadge.appendChild(label)
  _overlay.appendChild(_liveBadge)
}

function _buildCornerBranding() {
  _branding = document.createElement('div')
  Object.assign(_branding.style, {
    position: 'absolute',
    top: '14px',
    left: '18px',
    fontFamily: 'monospace',
    fontSize: '11px',
    letterSpacing: '0.3em',
    color: 'rgba(255,255,255,0.22)',
    fontWeight: 'bold',
  })
  _branding.textContent = 'ARTLAB'
  _overlay.appendChild(_branding)
}

function _buildLowerThird() {
  _lowerThird = document.createElement('div')
  Object.assign(_lowerThird.style, {
    position: 'absolute',
    bottom: '60px',
    left: '0',
    width: 'max-content',
    maxWidth: '55%',
    background: 'linear-gradient(90deg, #0a1a3a 0%, #112244 70%, transparent 100%)',
    borderLeft: '4px solid #00aaff',
    padding: '10px 32px 10px 18px',
    transform: 'translateX(-110%)',
    willChange: 'transform',
  })

  const name = document.createElement('div')
  Object.assign(name.style, {
    fontFamily: 'sans-serif',
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: '0.05em',
    lineHeight: '1.25',
  })
  name.textContent = 'Creative Coding Student'

  const title = document.createElement('div')
  Object.assign(title.style, {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: '#00ccff',
    letterSpacing: '0.2em',
    marginTop: '3px',
    textTransform: 'uppercase',
  })
  title.textContent = 'Multimedia Arts · Spring 2026'

  _lowerThird.appendChild(name)
  _lowerThird.appendChild(title)
  _overlay.appendChild(_lowerThird)
}

function _buildTicker() {
  // Outer band
  const band = document.createElement('div')
  Object.assign(band.style, {
    position: 'absolute',
    bottom: '0',
    left: '0',
    right: '0',
    height: '28px',
    background: 'rgba(0,20,60,0.88)',
    borderTop: '2px solid rgba(0,170,255,0.5)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
  })

  // Label chip
  const chip = document.createElement('div')
  Object.assign(chip.style, {
    flexShrink: '0',
    background: '#0055cc',
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: '10px',
    fontWeight: 'bold',
    letterSpacing: '0.2em',
    padding: '0 10px',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    zIndex: '2',
  })
  chip.textContent = 'TOPICS'

  // Scrolling text wrapper
  const scroll = document.createElement('div')
  Object.assign(scroll.style, {
    position: 'absolute',
    left: '70px',
    right: '0',
    height: '100%',
    overflow: 'hidden',
  })

  _ticker = document.createElement('div')
  Object.assign(_ticker.style, {
    position: 'absolute',
    whiteSpace: 'nowrap',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#aaddff',
    letterSpacing: '0.08em',
    lineHeight: '28px',
    transform: 'translateX(0px)',
    willChange: 'transform',
  })
  _ticker.textContent = TICKER_TEXT + '  ·  ' + TICKER_TEXT   // double for seamless wrap

  scroll.appendChild(_ticker)
  band.appendChild(chip)
  band.appendChild(scroll)
  _overlay.appendChild(band)
}

// ── Gesture gate ──────────────────────────────────────────────────────────────

function _awaitGesture(container) {
  return new Promise(resolve => {
    let btn = container.querySelector('#vb-start-btn')
    if (!btn) {
      btn = document.createElement('button')
      btn.id = 'vb-start-btn'
      Object.assign(btn.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(8,14,38,0.92)',
        border: '1px solid rgba(0,170,255,0.55)',
        color: '#88ccff',
        padding: '14px 44px',
        cursor: 'pointer',
        fontSize: '12px',
        borderRadius: '3px',
        zIndex: '200',
        fontFamily: 'monospace',
        letterSpacing: '0.25em',
        pointerEvents: 'auto',
      })
      btn.textContent = '▶  Enable Camera'
      container.appendChild(btn)
    }
    btn.addEventListener('click', () => { btn.remove(); resolve() }, { once: true })
  })
}

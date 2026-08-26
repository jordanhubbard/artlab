import { createGame, restartGame, startGame, stepGame, togglePause } from './game.js'
import { createMediaInput } from './media-input.js'
import { createSignalScene } from './scene.js'
import { createSoundtrack } from './soundtrack.js'

const HELP = 'WASD / arrows: steer • Space: charge / pulse • P: pause • R: restart'
const CONTROL_KEYS = new Set([
  'arrowleft', 'arrowright', 'arrowup', 'arrowdown',
  'a', 'd', 'w', 's', ' ', 'spacebar',
])

let runtime = null

export function setup(ctx) {
  ctx.setHelp(HELP)
  if (runtime) cleanup(runtime)

  ctx.setBloom(1.15)
  ctx.camera.position.set(0, 0, 8)
  ctx.camera.lookAt(0, 0, -12)
  if (ctx.controls) ctx.controls.enabled = false

  const media = createMediaInput()
  const soundtrack = createSoundtrack()
  const state = createGame()
  const view = createSignalScene(ctx, media.texture)
  const ui = buildUi(ctx.renderer.domElement.parentElement)

  runtime = {
    ctx,
    media,
    soundtrack,
    state,
    view,
    ui,
    keys: new Set(),
    pulseReleased: false,
    started: false,
    starting: false,
    disposed: false,
    lastHud: '',
    onKeyDown: null,
    onKeyUp: null,
  }
  bindControls(runtime)
  ui.button.addEventListener('click', () => startMission(runtime), { once: true })
  updateHud(runtime)
}

export function update(ctx, dt) {
  const current = runtime
  if (!current || current.disposed || current.ctx !== ctx) return

  const frameDt = Math.max(0, Math.min(0.05, dt))
  let events = []
  if (current.started) {
    current.media.update(ctx.elapsed)
    const input = readInput(current)
    events = stepGame(current.state, input, frameDt)
    current.pulseReleased = false
    current.soundtrack.handle(events)
    current.soundtrack.update(current.state, current.media.micEnergy)
  }
  current.view.sync(current.state, events, frameDt)
  updateHud(current)
}

export async function teardown(ctx) {
  if (!runtime || (ctx && runtime.ctx !== ctx)) return
  const current = runtime
  runtime = null
  await cleanup(current)
}

async function startMission(current) {
  if (current.starting || current.started || current.disposed) return
  current.starting = true
  current.ui.button.disabled = true
  current.ui.button.textContent = 'AWAKENING SIGNAL…'
  current.ui.status.textContent = 'Requesting camera and microphone independently…'

  await Promise.allSettled([
    current.soundtrack.start(),
    current.media.start(),
  ])
  if (current.disposed) return

  current.view.setTexture(current.media.texture)
  startGame(current.state)
  current.started = true
  current.starting = false
  current.ui.onboarding.remove()
  current.ui.button.remove()
  updateHud(current)
}

function bindControls(current) {
  current.onKeyDown = event => {
    const key = event.key.toLowerCase()
    if (CONTROL_KEYS.has(key)) event.preventDefault()
    if (event.repeat && (key === 'p' || key === 'r')) return

    if (key === 'p' && current.started) {
      togglePause(current.state)
    } else if (key === 'r' && current.started) {
      restartGame(current.state)
    } else {
      current.keys.add(key)
    }
    updateHud(current)
  }
  current.onKeyUp = event => {
    const key = event.key.toLowerCase()
    current.keys.delete(key)
    if (key === ' ' || key === 'spacebar') current.pulseReleased = true
  }
  window.addEventListener('keydown', current.onKeyDown)
  window.addEventListener('keyup', current.onKeyUp)
}

function readInput(current) {
  const keys = current.keys
  const keyboardX = axis(keys, 'arrowleft', 'a', 'arrowright', 'd')
  const keyboardY = axis(keys, 'arrowdown', 's', 'arrowup', 'w')
  return {
    x: clamp(keyboardX + current.media.motion.x * 0.45, -1, 1),
    y: clamp(keyboardY + current.media.motion.y * 0.45, -1, 1),
    pulseHeld: keys.has(' ') || keys.has('spacebar'),
    pulseReleased: current.pulseReleased,
    micEnergy: current.media.micEnergy,
  }
}

function axis(keys, negativeA, negativeB, positiveA, positiveB) {
  const negative = keys.has(negativeA) || keys.has(negativeB) ? 1 : 0
  const positive = keys.has(positiveA) || keys.has(positiveB) ? 1 : 0
  return positive - negative
}

function buildUi(container) {
  const root = document.createElement('div')
  root.dataset.signalSalvage = ''
  Object.assign(root.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '90',
    color: '#c8ffe8',
    font: '11px/1.65 monospace',
    letterSpacing: '0.08em',
  })

  const onboarding = document.createElement('div')
  Object.assign(onboarding.style, {
    position: 'absolute',
    left: '50%',
    top: '45%',
    width: 'min(440px, 80%)',
    transform: 'translate(-50%, -50%)',
    padding: '22px 26px',
    background: 'rgba(4, 18, 24, 0.88)',
    border: '1px solid rgba(126, 255, 220, 0.38)',
    borderRadius: '18px 6px 18px 6px',
    textAlign: 'center',
    backdropFilter: 'blur(8px)',
  })
  onboarding.innerHTML = [
    '<strong style="font-size:18px;letter-spacing:.25em">SIGNAL SALVAGE</strong>',
    '<p>Pilot a living skiff. Gather memory seeds. Repel corruption blooms.</p>',
    '<p style="color:#83b9aa">Camera motion and microphone energy enhance play. ',
    'Media is processed locally and is never recorded, uploaded, or retained.</p>',
    `<p>${HELP}</p>`,
  ].join('')

  const status = document.createElement('div')
  status.textContent = 'Keyboard fallback is always available.'
  onboarding.appendChild(status)

  const button = document.createElement('button')
  button.textContent = 'START MISSION'
  Object.assign(button.style, {
    position: 'absolute',
    left: '50%',
    top: '72%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'auto',
    padding: '13px 34px',
    color: '#d8fff2',
    background: 'rgba(13, 70, 61, 0.92)',
    border: '1px solid #72e8c3',
    borderRadius: '20px 5px 20px 5px',
    cursor: 'pointer',
    font: '12px monospace',
    letterSpacing: '0.2em',
  })

  const hud = document.createElement('pre')
  Object.assign(hud.style, {
    position: 'absolute',
    left: '18px',
    top: '14px',
    margin: '0',
    color: '#b9ffe6',
    textShadow: '0 0 10px rgba(80,255,200,.5)',
  })

  root.append(onboarding, button, hud)
  container.appendChild(root)
  return { root, onboarding, status, button, hud }
}

function updateHud(current) {
  const state = current.state
  const seconds = Math.ceil(state.timeRemaining)
  const phase = state.phase === 'paused' ? 'PAUSED' : state.phase.toUpperCase()
  const text = [
    `SIGNAL SALVAGE  ${phase}`,
    `SCORE   ${String(state.score).padStart(6, '0')}   COMBO  ×${state.combo}`,
    `TIME    ${String(seconds).padStart(2, '0')}       WAVE   ${state.wave}/3`,
    `HEALTH  ${'●'.repeat(state.health)}${'○'.repeat(3 - state.health)}`,
    `PULSE   ${meter(state.pulseCharge)}`,
    `CAMERA  ${current.media.cameraStatus.toUpperCase()}`,
    `MIC     ${current.media.microphoneStatus.toUpperCase()}`,
    `AUDIO   ${current.soundtrack.status.toUpperCase()}`,
  ].join('\n')
  if (text !== current.lastHud) {
    current.ui.hud.textContent = text
    current.lastHud = text
  }
}

async function cleanup(current) {
  if (current.disposed) return
  current.disposed = true
  window.removeEventListener('keydown', current.onKeyDown)
  window.removeEventListener('keyup', current.onKeyUp)
  current.ui.root.remove()
  current.soundtrack.dispose()
  current.view.dispose()
  if (current.ctx.controls) current.ctx.controls.enabled = true
  await current.media.dispose()
}

function meter(value) {
  const filled = Math.round(value * 10)
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

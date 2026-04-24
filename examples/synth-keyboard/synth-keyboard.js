// synth-keyboard — piano keys spawn colored particle fountains per note with reverb trails.
import * as Three from 'three'
import * as Tone from 'tone'

const WHITE_KEYS = ['C4','D4','E4','F4','G4','A4','B4','C5']
const BLACK_KEYS = [null,'C#4','D#4',null,'F#4','G#4','A#4',null]
const KEY_MAP_WHITE = { a:'C4', s:'D4', d:'E4', f:'F4', g:'G4', h:'A4', j:'B4', k:'C5' }
const KEY_MAP_BLACK = { w:'C#4', e:'D#4', t:'F#4', y:'G#4', u:'A#4' }

const NOTE_HUES = { C:0, 'C#':30, D:50, 'D#':80, E:110, F:140, 'F#':170, G:195, 'G#':220, A:250, 'A#':280, B:310 }
const MAX_PARTICLES = 2000
const PARTICLES_PER_NOTE = 40

function noteHue(note) {
  const name = note.replace(/\d+/, '')
  return (NOTE_HUES[name] || 0) / 360
}

export async function setup(ctx) {
  ctx.setHelp('White keys: A S D F G H J K   •   Black keys: W E T Y U')
  ctx.camera.position.set(0, 5, 10)
  ctx.camera.lookAt(0, 1, 0)
  ctx.setBloom(0.8)

  const ambient = new Three.AmbientLight(0x111122, 1.0)
  ctx.add(ambient)
  const dir = new Three.DirectionalLight(0xffffff, 1.2)
  dir.position.set(5, 10, 5)
  ctx.add(dir)
  ctx._lights = [ambient, dir]

  // Tone.js synth with reverb
  ctx._toneStarted = false
  ctx._synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle8' },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 1.0 },
  })
  ctx._reverb = new Tone.Reverb({ decay: 2.5, wet: 0.4 })
  ctx._synth.connect(ctx._reverb)
  ctx._reverb.toDestination()

  // Visual keys
  ctx._keyMeshes = []
  const totalWidth = WHITE_KEYS.length * 0.9
  const startX = -totalWidth / 2

  for (let i = 0; i < WHITE_KEYS.length; i++) {
    const geo = new Three.BoxGeometry(0.8, 0.3, 2.0)
    const mat = new Three.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 })
    const mesh = new Three.Mesh(geo, mat)
    mesh.position.set(startX + i * 0.9, 0, 0)
    ctx.add(mesh)
    ctx._keyMeshes.push({ mesh, note: WHITE_KEYS[i], isBlack: false, baseY: 0 })
  }

  for (let i = 0; i < BLACK_KEYS.length; i++) {
    if (!BLACK_KEYS[i]) continue
    const geo = new Three.BoxGeometry(0.5, 0.35, 1.2)
    const mat = new Three.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 })
    const mesh = new Three.Mesh(geo, mat)
    mesh.position.set(startX + i * 0.9 + 0.45, 0.2, -0.4)
    ctx.add(mesh)
    ctx._keyMeshes.push({ mesh, note: BLACK_KEYS[i], isBlack: true, baseY: 0.2 })
  }

  // Particle system
  const pGeo = new Three.BufferGeometry()
  const positions = new Float32Array(MAX_PARTICLES * 3)
  const colors = new Float32Array(MAX_PARTICLES * 3)
  const sizes = new Float32Array(MAX_PARTICLES)
  pGeo.setAttribute('position', new Three.BufferAttribute(positions, 3))
  pGeo.setAttribute('color', new Three.BufferAttribute(colors, 3))
  pGeo.setAttribute('size', new Three.BufferAttribute(sizes, 1))
  pGeo.attributes.position.setUsage(Three.DynamicDrawUsage)
  pGeo.attributes.color.setUsage(Three.DynamicDrawUsage)
  pGeo.attributes.size.setUsage(Three.DynamicDrawUsage)

  const pMat = new Three.PointsMaterial({
    size: 0.15, vertexColors: true, transparent: true, opacity: 0.8,
    blending: Three.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  })
  ctx._particleSystem = new Three.Points(pGeo, pMat)
  ctx.add(ctx._particleSystem)

  ctx._particles = [] // active particles: {idx, vx, vy, vz, life, maxLife}
  ctx._nextParticle = 0
  ctx._activeKeys = new Set()

  ctx._onKeyDown = async (e) => {
    if (e.repeat) return
    const note = KEY_MAP_WHITE[e.key] || KEY_MAP_BLACK[e.key]
    if (!note || ctx._activeKeys.has(note)) return
    ctx._activeKeys.add(note)

    if (!ctx._toneStarted) {
      await Tone.start()
      ctx._toneStarted = true
    }
    ctx._synth.triggerAttack(note)
    spawnFountain(ctx, note)

    // Animate key press
    const keyObj = ctx._keyMeshes.find(k => k.note === note)
    if (keyObj) keyObj.mesh.position.y = keyObj.baseY - 0.1
  }

  ctx._onKeyUp = (e) => {
    const note = KEY_MAP_WHITE[e.key] || KEY_MAP_BLACK[e.key]
    if (!note) return
    ctx._activeKeys.delete(note)
    ctx._synth.triggerRelease(note)

    const keyObj = ctx._keyMeshes.find(k => k.note === note)
    if (keyObj) keyObj.mesh.position.y = keyObj.baseY
  }

  window.addEventListener('keydown', ctx._onKeyDown)
  window.addEventListener('keyup', ctx._onKeyUp)
}

function spawnFountain(ctx, note) {
  const keyObj = ctx._keyMeshes.find(k => k.note === note)
  if (!keyObj) return
  const kx = keyObj.mesh.position.x
  const kz = keyObj.mesh.position.z
  const hue = noteHue(note)
  const col = new Three.Color().setHSL(hue, 0.8, 0.6)

  const pos = ctx._particleSystem.geometry.attributes.position
  const colors = ctx._particleSystem.geometry.attributes.color
  const sizes = ctx._particleSystem.geometry.attributes.size

  for (let i = 0; i < PARTICLES_PER_NOTE; i++) {
    const idx = ctx._nextParticle % MAX_PARTICLES
    ctx._nextParticle++

    pos.setXYZ(idx, kx + (Math.random() - 0.5) * 0.3, 0.5, kz)
    colors.setXYZ(idx, col.r, col.g, col.b)
    sizes.setX(idx, 0.12 + Math.random() * 0.08)

    ctx._particles.push({
      idx,
      vx: (Math.random() - 0.5) * 2,
      vy: 3 + Math.random() * 4,
      vz: (Math.random() - 0.5) * 2,
      life: 1.0,
      maxLife: 1.5 + Math.random() * 1.5,
    })
  }
}

export function update(ctx, dt) {
  const dt_ = Math.min(dt, 0.05)
  const pos = ctx._particleSystem.geometry.attributes.position
  const sizes = ctx._particleSystem.geometry.attributes.size

  for (let i = ctx._particles.length - 1; i >= 0; i--) {
    const p = ctx._particles[i]
    p.life -= dt_ / p.maxLife
    if (p.life <= 0) {
      pos.setXYZ(p.idx, 0, -100, 0)
      sizes.setX(p.idx, 0)
      ctx._particles.splice(i, 1)
      continue
    }

    const x = pos.getX(p.idx) + p.vx * dt_
    const y = pos.getY(p.idx) + p.vy * dt_
    const z = pos.getZ(p.idx) + p.vz * dt_
    p.vy -= 5.0 * dt_ // gravity
    pos.setXYZ(p.idx, x, y, z)
    sizes.setX(p.idx, 0.15 * p.life)
  }

  pos.needsUpdate = true
  sizes.needsUpdate = true
}

export function teardown(ctx) {
  window.removeEventListener('keydown', ctx._onKeyDown)
  window.removeEventListener('keyup', ctx._onKeyUp)
  for (const k of ctx._keyMeshes) ctx.remove(k.mesh)
  ctx.remove(ctx._particleSystem)
  ctx._particleSystem.geometry.dispose()
  ctx._particleSystem.material.dispose()
  for (const l of ctx._lights) ctx.remove(l)
  ctx._synth.dispose()
  ctx._reverb.dispose()
}

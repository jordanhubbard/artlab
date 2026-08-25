// Spatial bell orrery — five FM bowls orbit an obelisk; listener follows the camera.
import * as Three from 'three'
import * as Tone from 'tone'
import { engine } from '../../src/stdlib/audio.js'

const NOTES = ['C3', 'E3', 'G3', 'A3', 'D4']
const COLORS = [0xc9a227, 0xd4b45a, 0xaa8844, 0xe8d48a, 0x8a7030]
const RADII = [6.5, 5.2, 4.1, 3.2, 2.3]
const INCLINE = [0.35, -0.22, 0.48, -0.4, 0.15]
const SPEEDS = [0.22, 0.33, 0.47, 0.61, 0.79]

let added = []
let bells = []
let startBtn = null
let started = false
let starting = false
let showTrails = true
let onKey = null
let onClick = null
let _pos = new Three.Vector3()
let _fwd = new Three.Vector3()
let _ndc = new Three.Vector2()
let raycaster = new Three.Raycaster()

function styleButton(btn) {
  btn.style.cssText = [
    'position:absolute', 'bottom:50%', 'left:50%', 'transform:translate(-50%,50%)',
    'background:rgba(10,12,24,0.92)', 'border:1px solid rgba(201,162,39,0.55)',
    'color:#e8d48a', 'padding:14px 40px', 'cursor:pointer', 'z-index:100',
    'font-family:monospace', 'letter-spacing:0.18em', 'font-size:13px',
    'border-radius:4px',
  ].join(';')
}

function makeBell(i) {
  const pivot = new Three.Object3D()
  pivot.rotation.x = INCLINE[i]
  const geo = new Three.TorusGeometry(1.05 - i * 0.08, 0.08, 10, 48)
  const mat = new Three.MeshStandardMaterial({
    color: COLORS[i],
    metalness: 0.85,
    roughness: 0.28,
    emissive: new Three.Color(COLORS[i]),
    emissiveIntensity: 0.18,
  })
  const mesh = new Three.Mesh(geo, mat)
  mesh.position.x = RADII[i]
  mesh.rotation.x = Math.PI / 2
  pivot.add(mesh)

  const trailGeo = new Three.BufferGeometry()
  const trailCount = 48
  const trailPos = new Float32Array(trailCount * 3)
  trailGeo.setAttribute('position', new Three.BufferAttribute(trailPos, 3))
  const trail = new Three.Line(trailGeo, new Three.LineBasicMaterial({
    color: COLORS[i], transparent: true, opacity: 0.35,
  }))
  trail.visible = showTrails

  return {
    pivot, mesh, trail, trailPos, trailCount, trailHead: 0,
    speed: SPEEDS[i],
    note: NOTES[i],
    prevZ: mesh.position.z,
    glow: 0,
    synth: null,
    spatial: null,
  }
}

function strike(bell) {
  bell.synth?.triggerAttackRelease(bell.note, '8n')
  bell.glow = 1
}

function syncListener(camera) {
  const listener = engine.audioContext?.listener
  if (!listener) return
  camera.getWorldPosition(_pos)
  camera.getWorldDirection(_fwd)
  if (listener.positionX) {
    listener.positionX.value = _pos.x
    listener.positionY.value = _pos.y
    listener.positionZ.value = _pos.z
    listener.forwardX.value = _fwd.x
    listener.forwardY.value = _fwd.y
    listener.forwardZ.value = _fwd.z
    listener.upX.value = 0
    listener.upY.value = 1
    listener.upZ.value = 0
  }
}

async function startAudio() {
  await engine.start()
  for (const bell of bells) {
    const synth = new Tone.FMSynth({
      harmonicity: 3.4,
      modulationIndex: 8,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.05, release: 1.4 },
      modulation: { type: 'square' },
      volume: -10,
    })
    // Tone sources must be panned by a Tone node: stdlib spatialize() builds its
    // PannerNode on the raw AudioContext, which Tone's wrapper won't accept as a
    // connect target. Panner3D writes to the same native listener syncListener uses.
    const panner = new Tone.Panner3D({
      panningModel: 'HRTF',
      refDistance: 2.5,
      maxDistance: 40,
      rolloffFactor: 1.2,
    }).toDestination()
    synth.connect(panner)
    bell.synth = synth
    bell.spatial = {
      update(obj) {
        obj.getWorldPosition(_pos)
        panner.positionX.value = _pos.x
        panner.positionY.value = _pos.y
        panner.positionZ.value = _pos.z
      },
      disconnect() { panner.dispose() },
    }
  }
  started = true
}

export function setup(ctx) {
  ctx.setHelp('Start  •  Click a ring to strike  •  Space: trails  •  orbit the camera to move the listener')
  ctx.setBloom(0.55)
  ctx.camera.position.set(0, 9, 16)
  ctx.camera.lookAt(0, 2, 0)
  if (ctx.controls) {
    ctx.controls.target.set(0, 2, 0)
    ctx.controls.update?.()
  }

  const amb = new Three.AmbientLight(0x223344, 0.7)
  ctx.add(amb)
  added.push(amb)
  const key = new Three.DirectionalLight(0xffe6aa, 1.1)
  key.position.set(6, 14, 8)
  ctx.add(key)
  added.push(key)

  const grid = new Three.GridHelper(24, 24, 0x223344, 0x111820)
  ctx.add(grid)
  added.push(grid)

  const obelisk = new Three.Mesh(
    new Three.BoxGeometry(0.7, 5.5, 0.7),
    new Three.MeshStandardMaterial({ color: 0x14141c, roughness: 0.9, metalness: 0.2 }),
  )
  obelisk.position.y = 2.75
  ctx.add(obelisk)
  added.push(obelisk)

  bells = []
  for (let i = 0; i < 5; i++) {
    const bell = makeBell(i)
    ctx.add(bell.pivot)
    ctx.add(bell.trail)
    added.push(bell.pivot, bell.trail)
    bells.push(bell)
  }

  const container = ctx.renderer.domElement.parentElement
  container.style.position = 'relative'
  startBtn = document.createElement('button')
  startBtn.textContent = 'Start Bells'
  styleButton(startBtn)
  // Hide before awaiting: if audio init stalls the button must not linger,
  // and it has to come back clickable when init fails outright.
  startBtn.addEventListener('click', async () => {
    if (started || starting) return
    starting = true
    startBtn.style.display = 'none'
    try {
      await startAudio()
      startBtn?.remove()
      startBtn = null
    } catch (err) {
      console.error('bell-orrery: audio init failed', err)
      startBtn.textContent = 'Retry Bells'
      startBtn.style.display = ''
    } finally {
      starting = false
    }
  })
  container.appendChild(startBtn)

  onKey = (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault()
      showTrails = !showTrails
      for (const b of bells) b.trail.visible = showTrails
    }
  }
  window.addEventListener('keydown', onKey)

  onClick = (e) => {
    if (!started) return
    const rect = ctx.renderer.domElement.getBoundingClientRect()
    _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(_ndc, ctx.camera)
    const hits = raycaster.intersectObjects(bells.map(b => b.mesh))
    if (hits[0]) {
      const bell = bells.find(b => b.mesh === hits[0].object)
      if (bell) {
        bell.speed *= 1.06
        strike(bell)
      }
    }
  }
  ctx.renderer.domElement.addEventListener('click', onClick)
}

export function update(ctx, dt) {
  syncListener(ctx.camera)
  for (const bell of bells) {
    bell.pivot.rotation.y += bell.speed * dt
    bell.mesh.getWorldPosition(_pos)
    if (started && bell.prevZ >= 0 && _pos.z < 0) strike(bell)
    bell.prevZ = _pos.z

    if (bell.spatial) bell.spatial.update(bell.mesh)

    bell.glow = Math.max(0, bell.glow - dt * 2.2)
    bell.mesh.material.emissiveIntensity = 0.18 + bell.glow * 1.4

    const attr = bell.trail.geometry.attributes.position
    const i = bell.trailHead % bell.trailCount
    attr.array[i * 3] = _pos.x
    attr.array[i * 3 + 1] = _pos.y
    attr.array[i * 3 + 2] = _pos.z
    bell.trailHead++
    attr.needsUpdate = true
  }
}

export async function teardown(ctx) {
  window.removeEventListener('keydown', onKey)
  ctx.renderer.domElement.removeEventListener('click', onClick)
  startBtn?.remove()
  startBtn = null
  for (const bell of bells) {
    bell.spatial?.disconnect()
    bell.synth?.dispose()
  }
  bells = []
  for (const obj of added) ctx.remove(obj)
  added = []
  started = false
  starting = false
  await engine.stop()
}

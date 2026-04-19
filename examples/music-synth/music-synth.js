// Music Synth — generative music using artlab/audio scale, chord, and sequencer helpers.
// A chord progression plays in A minor. Each chord triggers a burst of 3D geometry.
// Four voices: bass pad, arp melody, chord synth, snare/hit accents.

import * as Tone from 'tone'
import * as THREE from 'three'
import {
  scale, chord, progression, sequencer, reverb, delay,
} from '../../src/stdlib/audio.js'

// ── Music setup ──────────────────────────────────────────────────────────────

const ROOT   = 'A'
const MODE   = 'minor'
const OCTAVE = 2

// i - VI - III - VII in A natural minor
const PROG   = progression(ROOT, 'i-VI-III-VII', MODE, OCTAVE)
const MELODY = scale(ROOT, MODE, 2, 3)   // 2-octave melodic scale for arp

// ── 3D visual state ──────────────────────────────────────────────────────────

let _rings, _particles, _chordLabel, _beatFlash
let _onKey, _isStarted = false
let _seq, _chordSeq, _bassSeq, _rev, _dly
let _chordIdx = 0, _beatT = 0
let _melodyIdx = 0
let _startBtn

// ── Synth voices ─────────────────────────────────────────────────────────────

let _arpSynth, _chordSynth, _bassSynth, _noise

function _buildSynths() {
  _rev = reverb({ decay: 4, wet: 0.55 })
  _dly = delay({ delayTime: '8n', feedback: 0.3, wet: 0.25 })

  // Arpeggio — bright pluck
  _arpSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope:   { attack: 0.01, decay: 0.25, sustain: 0.1, release: 0.8 },
    volume: -8,
  }).connect(_dly).connect(_rev)

  // Chord pad — warm sine cluster
  _chordSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope:   { attack: 0.4, decay: 0.3, sustain: 0.7, release: 2.0 },
    volume: -14,
  }).connect(_rev)

  // Bass — sine sub
  _bassSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope:   { attack: 0.08, decay: 0.4, sustain: 0.6, release: 1.2 },
    volume: -6,
  }).toDestination()

  // Accent noise burst
  _noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.005, decay: 0.06, sustain: 0, release: 0.1 },
    volume: -22,
  }).connect(_rev)
}

// ── Sequencers ────────────────────────────────────────────────────────────────

function _buildSequencers() {
  // Arp: plays up the MELODY scale one note per 8th note
  _seq = sequencer({
    notes:       MELODY,
    subdivision: '8n',
    onStep: (note, i) => {
      _arpSynth.triggerAttackRelease(note, '16n')
      _melodyIdx = i
    },
  })

  // Chord: changes every bar (4 beats = 1 measure)
  _chordSeq = new Tone.Sequence((time, idx) => {
    const notes = PROG[idx % PROG.length]
    _chordSynth.releaseAll(time)
    _chordSynth.triggerAttack(notes, time)
    _chordIdx = idx % PROG.length
    _beatT = Tone.now()
    _noise.triggerAttackRelease('4n', time)
  }, [0, 1, 2, 3], '1m')

  // Bass: root note every beat
  _bassSeq = new Tone.Sequence((time, idx) => {
    const chordNotes = PROG[Math.floor(idx / 4) % PROG.length]
    const rootNote   = chordNotes[0]
    // Drop one octave for bass
    const noteName = rootNote.replace(/\d+/, n => String(Math.max(0, parseInt(n) - 1)))
    _bassSynth.triggerAttackRelease(noteName, '8n', time)
  }, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], '4n')

  Tone.Transport.bpm.value = 96
  _seq.start(0)
  _chordSeq.start(0)
  _bassSeq.start(0)
  Tone.Transport.start()
}

// ── 3D visuals ────────────────────────────────────────────────────────────────

const CHORD_COLORS = [0x4466ff, 0xff6644, 0x44dd88, 0xffcc22]

function _build3D(ctx) {
  // Ring array — one per chord in progression
  _rings = []
  for (let ci = 0; ci < PROG.length; ci++) {
    const geo = new THREE.TorusGeometry(2 + ci * 1.4, 0.06, 8, 80)
    const mat = new THREE.MeshStandardMaterial({
      color: CHORD_COLORS[ci], emissive: new THREE.Color(CHORD_COLORS[ci]),
      emissiveIntensity: 0.3, roughness: 0.4, metalness: 0.6,
    })
    const ring = new THREE.Mesh(geo, mat)
    ring.rotation.x = (ci * 0.4)
    ctx.add(ring)
    _rings.push(ring)
  }

  // Particle sphere
  const COUNT = 480
  const pos = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    const phi   = Math.acos(1 - 2 * Math.random())
    const theta = Math.random() * Math.PI * 2
    const r = 6 + (Math.random() - 0.5) * 3
    pos[i*3]   = r * Math.sin(phi) * Math.cos(theta)
    pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta)
    pos[i*3+2] = r * Math.cos(phi)
  }
  const pgeo = new THREE.BufferGeometry()
  pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  _particles = new THREE.Points(pgeo, new THREE.PointsMaterial({
    color: 0x4488cc, size: 0.07, transparent: true, opacity: 0.6,
  }))
  ctx.add(_particles)

  // Beat flash sphere (center)
  _beatFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8899ff, emissiveIntensity: 0.5, roughness: 0.2 })
  )
  ctx.add(_beatFlash)

  // Chord label
  _chordLabel = document.createElement('div')
  Object.assign(_chordLabel.style, {
    position: 'fixed', bottom: '52px', left: '50%', transform: 'translateX(-50%)',
    fontFamily: 'monospace', fontSize: '13px', letterSpacing: '.25em',
    color: '#6688aa', pointerEvents: 'none', zIndex: '10',
  })
  document.body.appendChild(_chordLabel)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function setup(ctx) {
  ctx.camera.position.set(0, 3, 16)
  ctx.camera.lookAt(0, 0, 0)

  ctx.add(new THREE.AmbientLight(0x111122, 0.6))
  const pt = new THREE.PointLight(0xffffff, 1.5, 60, 2)
  pt.position.set(0, 8, 6)
  ctx.add(pt)

  _build3D(ctx)
  ctx.setBloom(0.6)

  // Start button — audio requires user gesture
  _startBtn = document.createElement('button')
  Object.assign(_startBtn.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(10,14,36,0.92)', border: '1px solid rgba(80,140,255,0.5)',
    color: '#88aaff', padding: '11px 36px', cursor: 'pointer',
    fontFamily: 'monospace', fontSize: '12px', letterSpacing: '.25em',
    borderRadius: '3px', zIndex: '100',
  })
  _startBtn.textContent = 'Start Music'
  document.body.appendChild(_startBtn)

  _startBtn.addEventListener('click', async () => {
    _startBtn.style.display = 'none'
    await Tone.start()
    _buildSynths()
    _buildSequencers()
    _isStarted = true
  }, { once: true })

  _onKey = e => {
    if ((e.key === ' ' || e.key === 'Spacebar') && _isStarted) {
      if (Tone.Transport.state === 'started') Tone.Transport.pause()
      else Tone.Transport.start()
    }
  }
  window.addEventListener('keydown', _onKey)
}

export function update(ctx, dt) {
  const t = ctx.elapsed
  const isPlaying = _isStarted && Tone.Transport.state === 'started'

  // Rotate rings; active chord ring pulses
  if (_rings) {
    for (let i = 0; i < _rings.length; i++) {
      _rings[i].rotation.y += (0.15 + i * 0.04) * dt
      _rings[i].rotation.z += (0.08 + i * 0.02) * dt
      const isActive = isPlaying && i === _chordIdx
      const targetEI = isActive ? (0.8 + 0.6 * Math.sin(t * 8)) : 0.2
      const mat = _rings[i].material
      mat.emissiveIntensity += (targetEI - mat.emissiveIntensity) * 0.12
      if (isActive) {
        const col = new THREE.Color(CHORD_COLORS[i])
        mat.emissive.lerp(col, 0.15)
      } else {
        mat.emissive.lerp(new THREE.Color(CHORD_COLORS[i]).multiplyScalar(0.3), 0.08)
      }
    }
  }

  // Particle shimmer — arp-driven
  if (_particles && isPlaying) {
    const melFrac = _melodyIdx / MELODY.length
    const col = new THREE.Color().setHSL(melFrac * 0.5 + 0.5, 0.8, 0.6)
    _particles.material.color.lerp(col, 0.05)
    _particles.rotation.y += 0.003 * dt * 60
  }

  // Beat flash
  if (_beatFlash) {
    const age = t - (_beatT || 0)
    const flash = Math.max(0, 1 - age * 6)
    _beatFlash.material.emissiveIntensity = 0.3 + flash * 1.5
    const sc = 1 + flash * 0.6
    _beatFlash.scale.set(sc, sc, sc)
  }

  // Update chord label
  if (_chordLabel && isPlaying) {
    const chordNotes = PROG[_chordIdx]
    const chordName  = ['Am', 'F', 'C', 'G'][_chordIdx]
    _chordLabel.textContent = `${chordName}  [ ${chordNotes.slice(0,3).join('  ')} ]`
  } else if (_chordLabel && !_isStarted) {
    _chordLabel.textContent = 'click Start Music to begin'
  }
}

export async function teardown(ctx) {
  window.removeEventListener('keydown', _onKey)
  _startBtn?.remove()
  _chordLabel?.remove()

  if (_seq)      { _seq.stop(); _seq.dispose() }
  if (_chordSeq) { _chordSeq.stop(); _chordSeq.dispose() }
  if (_bassSeq)  { _bassSeq.stop(); _bassSeq.dispose() }

  Tone.Transport.stop()

  if (_arpSynth)   _arpSynth.dispose()
  if (_chordSynth) _chordSynth.dispose()
  if (_bassSynth)  _bassSynth.dispose()
  if (_noise)      _noise.dispose()
  if (_rev)        _rev.dispose()
  if (_dly)        _dly.dispose()

  _isStarted = false
}

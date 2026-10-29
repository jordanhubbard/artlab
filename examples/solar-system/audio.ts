// Audio setup — proximity pads, FFT bloom binding, background drone.
//
// Uses Tone.js for musical synthesis: PolySynth/AMSynth pads in A natural minor,
// real Reverb + FeedbackDelay, and a Tone.Analyser for FFT reactivity.
//
// Must be initialised from a user-gesture handler (button click / keypress)
// because browsers block AudioContext creation otherwise.
//
// Exported surface:
//   setupAudio(ctx)      — call once from a user-gesture handler
//   updateAudio(ctx, dt) — call every frame from update()
//   teardownAudio(ctx)   — call when the tab goes hidden / package unloads

import * as Tone from 'tone'

// Distance thresholds for proximity-triggered note on/off
const NEAR_DIST = 60
const FAR_DIST  = 200

// A natural minor scale — one note per planet, outer → inner
const PLANET_NOTES = {
  neptune: 'A1',
  uranus:  'D2',
  saturn:  'E2',
  jupiter: 'A2',
  mars:    'E3',
  earth:   'A3',
  venus:   'C4',
  mercury: 'E4',
}

// Shared AMSynth options — soft, evolving pad character
const PAD_SYNTH_OPTIONS = {
  oscillator:         { type: 'sine' },
  envelope:           { attack: 3.0, decay: 0, sustain: 1.0, release: 6.0 },
  modulation:         { type: 'sine' },
  modulationEnvelope: { attack: 4.0, decay: 0, sustain: 0.8, release: 8.0 },
}

export async function setupAudio(ctx) {
  try {
    // Must be called from a user gesture — Tone.start() unlocks the AudioContext
    await Tone.start()

    // ── Effects chain ────────────────────────────────────────────────────────
    const reverb = new Tone.Reverb({ decay: 7, wet: 0.6 })
    await reverb.generate()   // Reverb needs an async IR generation step

    const delay = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback:  0.35,
      wet:       0.3,
    })

    const master = new Tone.Volume(-12)

    // Signal path: pads → reverb → delay → master → Destination
    reverb.connect(delay)
    delay.connect(master)
    master.toDestination()

    // ── FFT analyser ─────────────────────────────────────────────────────────
    const analyser = new Tone.Analyser('fft', 256)
    master.connect(analyser)

    // ── Per-planet pads ───────────────────────────────────────────────────────
    const pads       = {}
    const padVolumes = {}

    for (const [name] of Object.entries(PLANET_NOTES)) {
      const vol = new Tone.Volume(-Infinity)   // silent until camera is near
      const pad = new Tone.PolySynth(Tone.AMSynth, PAD_SYNTH_OPTIONS)
      pad.connect(vol)
      vol.connect(reverb)
      pads[name]       = pad
      padVolumes[name] = vol
    }

    // ── Background drone — A1, very quiet, very slow attack ──────────────────
    const droneVol = new Tone.Volume(-30)
    const drone    = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope:   { attack: 8.0, decay: 0, sustain: 1.0, release: 10.0 },
    })
    drone.connect(droneVol)
    droneVol.connect(reverb)
    drone.triggerAttack('A1')

    // ── LFO state (computed in updateAudio) ──────────────────────────────────
    let lfoPhase = 0

    ctx._audio = {
      pads,
      padVolumes,
      drone,
      droneVol,
      reverb,
      delay,
      master,
      analyser,
      _padPlaying: {},
      _lfoPhase:   lfoPhase,
    }
  } catch (e) {
    console.warn('Audio setup failed:', e)
  }
}

export function updateAudio(ctx, dt) {
  const a = ctx._audio
  if (!a) return

  // ── FFT analysis ─────────────────────────────────────────────────────────
  // getValue() returns Float32Array of dB values (roughly -120 to 0)
  const fft      = a.analyser.getValue()
  const binCount = fft.length

  // Bin ranges matching the spec
  const bassEnd = 13
  const midEnd  = 90
  // high: 90–127

  let bassSum = 0, midSum = 0, highSum = 0
  for (let i = 0;       i < bassEnd;  i++) bassSum  += (fft[i] + 120) / 120
  for (let i = bassEnd; i < midEnd;   i++) midSum   += (fft[i] + 120) / 120
  for (let i = midEnd;  i < binCount; i++) highSum  += (fft[i] + 120) / 120

  const bassAmp = bassSum / bassEnd
  const midAmp  = midSum  / (midEnd - bassEnd)
  const highAmp = highSum / (binCount - midEnd)

  // ── Drive bloom ───────────────────────────────────────────────────────────
  const bloomStrength = 0.5 + bassAmp * 0.5
  ctx._bloomStrength = bloomStrength
  if (ctx.setBloom) ctx.setBloom(bloomStrength)

  // ── Drive sun emissive ────────────────────────────────────────────────────
  if (ctx._sunMesh) {
    ctx._sunMesh.material.emissiveIntensity = 0.8 + midAmp * 0.8
  }

  // ── Star opacity reacts to high freq ─────────────────────────────────────
  if (ctx._stars) {
    ctx._stars.material.opacity = 0.6 + highAmp * 0.4
  }

  // ── Proximity-based note triggering ──────────────────────────────────────
  if (ctx._planets && ctx.camera) {
    const camPos = ctx.camera.position
    for (const [name, note] of Object.entries(PLANET_NOTES)) {
      const planet = ctx._planets[name]
      const pad    = a.pads[name]
      const vol    = a.padVolumes[name]
      if (!planet || !pad || !vol) continue

      const dx   = camPos.x - planet.position.x
      const dy   = camPos.y - planet.position.y
      const dz   = camPos.z - planet.position.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (dist < NEAR_DIST && !a._padPlaying[name]) {
        // Camera entered proximity — trigger the pad
        pad.triggerAttack(note, Tone.now())
        a._padPlaying[name] = true
        vol.volume.rampTo(-6, 2)
      } else if (dist > FAR_DIST && a._padPlaying[name]) {
        // Camera left proximity — release the pad
        pad.triggerRelease(Tone.now())
        a._padPlaying[name] = false
        vol.volume.rampTo(-Infinity, 4)
      } else if (dist >= NEAR_DIST && dist <= FAR_DIST && a._padPlaying[name]) {
        // In transition zone — scale volume smoothly -20 dB … -6 dB
        const t      = 1 - (dist - NEAR_DIST) / (FAR_DIST - NEAR_DIST)
        const targetDb = -20 + t * 14   // -20 dB (far edge) → -6 dB (near edge)
        vol.volume.rampTo(targetDb, 0.5)
      }
    }
  }

  // ── Slow master LFO — gentle ±1 dB breathing at 0.05 Hz ──────────────────
  a._lfoPhase = (a._lfoPhase + dt * 0.05 * Math.PI * 2) % (Math.PI * 2)
  const lfoDb = Math.sin(a._lfoPhase)   // ±1 dB around the master -12 dB base
  a.master.volume.rampTo(-12 + lfoDb, 0.5)
}

export function teardownAudio(ctx) {
  const a = ctx._audio
  if (!a) return

  try {
    // Release and dispose every pad
    for (const [name, pad] of Object.entries(a.pads)) {
      try {
        if (a._padPlaying[name]) pad.triggerRelease(Tone.now())
        pad.dispose()
      } catch (_) { /* ignore disposal errors on already-stopped nodes */ }
    }

    // Dispose per-pad volume nodes
    for (const vol of Object.values(a.padVolumes)) {
      try { vol.dispose() } catch (_) {}
    }

    // Release and dispose drone
    try {
      a.drone.triggerRelease(Tone.now())
      a.drone.dispose()
    } catch (_) {}
    try { a.droneVol.dispose() } catch (_) {}

    // Dispose effects and master
    try { a.reverb.dispose()   } catch (_) {}
    try { a.delay.dispose()    } catch (_) {}
    try { a.master.dispose()   } catch (_) {}
    try { a.analyser.dispose() } catch (_) {}

    // Stop transport and close the AudioContext
    Tone.Transport.stop()
    Tone.context.close()
  } catch (e) {
    console.warn('Audio teardown error:', e)
  } finally {
    ctx._audio = null
  }
}

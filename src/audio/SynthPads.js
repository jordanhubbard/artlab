import { PLANET_DATA, PLANET_ORDER } from '../orbital/planetData.js'

/**
 * Creates one FMSynth pad per planet.
 * Pads fade in/out based on camera distance to each planet.
 */
export class SynthPads {
  constructor(audioEngine) {
    this._engine  = audioEngine
    this._synths  = {}
    this._active  = new Set()
    this._started = false
  }

  async init() {
    if (!this._engine.started) return
    const Tone = this._engine.Tone
    if (!Tone) return

    const fmDefaults = {
      harmonicity: 2.5,
      modulationIndex: 10,
      oscillator: { type: 'sine' },
      envelope: { attack: 5, decay: 2, sustain: 0.85, release: 10 },
      modulation: { type: 'triangle' },
      modulationEnvelope: { attack: 8, decay: 1, sustain: 0.9, release: 10 },
    }

    for (const name of PLANET_ORDER) {
      const data = PLANET_DATA[name]
      const synth = new Tone.FMSynth(fmDefaults)
      const vol   = new Tone.Volume(-40)  // start silent
      synth.connect(vol)
      vol.connect(this._engine.output)
      this._synths[name] = { synth, vol, note: data.toneNote, active: false }
    }

    this._started = true
    console.info('[audio] SynthPads initialized')
  }

  /**
   * Call each frame with camera-to-planet distances (map of name → distance)
   */
  update(distances) {
    if (!this._started) return

    for (const [name, dist] of Object.entries(distances)) {
      const pad = this._synths[name]
      if (!pad) continue

      // Volume ramp based on camera proximity (audible within ~800 units)
      const maxDist = 800
      const normalized = Math.max(0, 1 - dist / maxDist)
      const targetVol = -40 + normalized * 30  // -40dB (silent) → -10dB (loud)

      if (normalized > 0.05 && !pad.active) {
        pad.synth.triggerAttack(pad.note)
        pad.active = true
      } else if (normalized <= 0.02 && pad.active) {
        pad.synth.triggerRelease()
        pad.active = false
      }

      if (pad.active) {
        pad.vol.volume.rampTo(targetVol, 1.5)
      }
    }
  }

  dispose() {
    for (const { synth, vol } of Object.values(this._synths)) {
      synth.dispose()
      vol.dispose()
    }
  }
}

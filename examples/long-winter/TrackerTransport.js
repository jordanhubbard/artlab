import * as ToneModule from 'tone'
import { BPM, DURATION, musicalPosition, stepAt } from './score.js'

/** Nine original tracker songs sharing one audio-clock transport. */
export class TrackerTransport {
  constructor({ Tone = ToneModule, now = () => performance.now() / 1000 } = {}) {
    this.Tone = Tone
    this.now = now
    this.status = 'idle'
    this.nodes = []
    this.repeatId = null
    this.startedAt = 0
    this.pausedAt = 0
    this.activity = { melody: 0, chord: 0, bass: 0, drums: 0 }
    this.lastStep = -1
  }

  async start() {
    if (this.status === 'playing') return
    this.startedAt = this.now() - this.pausedAt
    try {
      await this.Tone.start()
      this.buildGraph()
      this.Tone.Transport.bpm.value = BPM
      this.Tone.Transport.seconds = this.pausedAt
      this.Tone.Transport.start()
      this.status = 'playing'
    } catch (error) {
      console.info('[long-winter] audio unavailable; continuing silently:', error?.message || error)
      this.status = 'silent'
    }
  }

  buildGraph() {
    if (this.nodes.length) return
    const Tone = this.Tone
    const limiter = this.keep(new Tone.Limiter(-3)).toDestination()
    const reverb = this.keep(new Tone.Reverb({ decay: 4.2, wet: 0.28 })).connect(limiter)
    const master = this.keep(new Tone.Volume(-11)).connect(reverb)
    this.leads = {
      chip: this.keep(new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.003, decay: 0.06, sustain: 0.12, release: 0.09 } })).connect(master),
      pluck: this.keep(new Tone.Synth({ oscillator: { type: 'triangle8' }, envelope: { attack: 0.008, decay: 0.18, sustain: 0.08, release: 0.3 } })).connect(master),
      bell: this.keep(new Tone.FMSynth({ harmonicity: 3, modulationIndex: 5, envelope: { attack: 0.01, decay: 0.5, sustain: 0.02, release: 1.1 } })).connect(master),
    }
    this.chords = this.keep(new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' }, envelope: { attack: 0.12, decay: 0.4, sustain: 0.22, release: 0.9 },
    })).connect(master)
    this.bass = this.keep(new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' }, filter: { type: 'lowpass', rolloff: -24, Q: 2 },
      envelope: { attack: 0.01, decay: 0.16, sustain: 0.24, release: 0.16 },
      filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.08, baseFrequency: 70, octaves: 2.6 },
    })).connect(master)
    this.kick = this.keep(new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5 })).connect(master)
    this.noise = this.keep(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -19 })).connect(master)
    this.repeatId = Tone.Transport.scheduleRepeat(time => this.playStep(time), '16n')
  }

  playStep(time) {
    const position = musicalPosition(this.Tone.Transport.seconds)
    const step = stepAt(position)
    if (step.step === this.lastStep) return
    this.lastStep = step.step
    const energy = 0.48 + position.actIndex * 0.055
    if (step.snare) {
      this.noise.triggerAttackRelease('16n', time, 0.42)
      this.activity.drums = 1
    } else if (step.hat) {
      this.noise.triggerAttackRelease('32n', time, 0.16 + energy * 0.18)
      this.activity.drums = 0.72
    }
    if (step.kick) {
      this.kick.triggerAttackRelease('A1', '8n', time, 0.55 + energy * 0.18)
      this.activity.drums = 1
    }
    if (step.bass) {
      this.bass.triggerAttackRelease(step.bassNote, '8n', time, 0.62)
      this.activity.bass = 1
    }
    if (step.chordHit) {
      this.chords.triggerAttackRelease(step.chord, position.act.id === 'fjord-mirror' ? '1m' : '2n', time, 0.36)
      this.activity.chord = 1
    }
    if (step.melody) {
      this.leads[position.act.song.voice].triggerAttackRelease(step.melodyNote, position.act.id === 'blue-hour' ? '8n' : '16n', time, 0.38)
      this.activity.melody = 1
    }
  }

  update(dt) {
    for (const voice of Object.keys(this.activity)) this.activity[voice] = Math.max(0, this.activity[voice] - dt * 5)
    if (this.seconds >= DURATION && this.status !== 'ended') {
      this.pausedAt = DURATION
      this.Tone.Transport.stop?.()
      this.status = 'ended'
    }
  }

  get seconds() {
    if (this.status === 'playing') return Math.min(DURATION, Number(this.Tone.Transport.seconds) || 0)
    if (this.status === 'silent') return Math.min(DURATION, Math.max(0, this.now() - this.startedAt))
    return this.pausedAt
  }

  get position() { return musicalPosition(this.seconds) }

  togglePause() {
    if (this.status === 'playing') {
      this.pausedAt = this.seconds
      this.Tone.Transport.pause()
      this.status = 'paused'
    } else if (this.status === 'silent') {
      this.pausedAt = this.seconds
      this.status = 'paused-silent'
    } else if (this.status === 'paused') {
      this.Tone.Transport.start()
      this.status = 'playing'
    } else if (this.status === 'paused-silent') {
      this.startedAt = this.now() - this.pausedAt
      this.status = 'silent'
    }
  }

  seek(seconds) {
    const target = Math.max(0, Math.min(DURATION, seconds))
    this.pausedAt = target
    this.lastStep = -1
    if (this.nodes.length) this.Tone.Transport.seconds = target
    if (this.status === 'silent') this.startedAt = this.now() - target
  }

  dispose() {
    if (this.repeatId !== null) this.Tone.Transport.clear(this.repeatId)
    this.Tone.Transport.stop?.()
    for (const node of this.nodes.reverse()) node.dispose?.()
    this.nodes.length = 0
    this.status = 'disposed'
  }

  keep(node) {
    this.nodes.push(node)
    return node
  }
}

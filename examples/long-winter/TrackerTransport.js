import * as ToneModule from 'tone'
import { BPM, DURATION, musicalPosition, stepAt } from './score.js'

const ROOTS = ['A2', 'F2', 'C3', 'G2']
const CHORDS = [
  ['A3', 'C4', 'E4'],
  ['F3', 'A3', 'C4'],
  ['C4', 'E4', 'G4'],
  ['G3', 'B3', 'D4'],
]
const NOTES = ['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6', 'F6', 'G6', 'A6', 'B6']

/** A small original tracker-style score whose audible clock drives the show. */
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
    const limiter = this.keep(new Tone.Limiter(-2)).toDestination()
    const reverb = this.keep(new Tone.Reverb({ decay: 3.6, wet: 0.32 })).connect(limiter)
    const master = this.keep(new Tone.Volume(-9)).connect(reverb)
    this.melody = this.keep(new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.08, sustain: 0.18, release: 0.12 },
    })).connect(master)
    this.chords = this.keep(new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.08, decay: 0.35, sustain: 0.28, release: 0.8 },
    })).connect(master)
    this.bass = this.keep(new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', rolloff: -24, Q: 2 },
      envelope: { attack: 0.01, decay: 0.18, sustain: 0.25, release: 0.18 },
      filterEnvelope: { attack: 0.01, decay: 0.12, sustain: 0.1, baseFrequency: 80, octaves: 2.5 },
    })).connect(master)
    this.kick = this.keep(new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5 })).connect(master)
    this.noise = this.keep(new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.055, sustain: 0 },
      volume: -17,
    })).connect(master)
    this.repeatId = Tone.Transport.scheduleRepeat(time => this.playStep(time), '16n')
  }

  playStep(time) {
    const position = musicalPosition(this.Tone.Transport.seconds)
    const step = stepAt(position)
    if (step.step === this.lastStep) return
    this.lastStep = step.step
    const energy = position.partIndex >= 4 ? 1 : position.partIndex >= 2 ? 0.75 : 0.5
    if (step.snare && position.partIndex >= 2) {
      this.noise.triggerAttackRelease('16n', time, 0.45)
      this.activity.drums = 1
    } else if (step.hat && position.partIndex > 0) {
      this.noise.triggerAttackRelease('32n', time, 0.18 + energy * 0.25)
      this.activity.drums = 1
    }
    if (step.kick) {
      this.kick.triggerAttackRelease('A1', '8n', time, 0.65 + energy * 0.2)
      this.activity.drums = 1
    }
    if (step.bass && position.partIndex >= 1) {
      this.bass.triggerAttackRelease(ROOTS[step.chord], '8n', time, 0.72)
      this.activity.bass = 1
    }
    if (step.chordHit) {
      this.chords.triggerAttackRelease(CHORDS[step.chord], '2n', time, 0.42)
      this.activity.chord = 1
    }
    if (step.step % 2 === 0 && position.partIndex !== 1) {
      this.melody.triggerAttackRelease(NOTES[step.melody], '16n', time, 0.32 + energy * 0.18)
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

import * as ToneModule from 'tone'
import type { GameState, GameEvent } from './game.ts'

export type SoundtrackTone = Pick<typeof ToneModule,
  'start' | 'Limiter' | 'Reverb' | 'Filter' | 'Volume' | 'PolySynth' | 'FMSynth'
  | 'MonoSynth' | 'Synth' | 'MembraneSynth' | 'NoiseSynth' | 'Transport'>
interface SoundGraph {
  filter: ToneModule.Filter; master: ToneModule.Volume;
  pad: ToneModule.PolySynth<ToneModule.FMSynth>; bass: ToneModule.MonoSynth;
  chime: ToneModule.Synth; pulse: ToneModule.MembraneSynth; noise: ToneModule.NoiseSynth;
}

const HARMONIC_SCENES = [
  {
    chords: [
      ['A3', 'C4', 'E4'], ['D3', 'A3', 'C4'],
      ['F3', 'A3', 'C4'], ['E3', 'G3', 'B3'],
    ],
    bass: ['A2', 'D2', 'F2', 'E2'],
    motif: ['E5', 'A5'],
  },
  {
    chords: [
      ['D3', 'F3', 'A3'], ['B2', 'D3', 'F3'],
      ['G3', 'B3', 'D4'], ['A3', 'C4', 'E4'],
    ],
    bass: ['D2', 'B1', 'G2', 'A2'],
    motif: ['F5', 'D5'],
  },
  {
    chords: [
      ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'],
      ['E3', 'G3', 'B3'], ['A3', 'C4', 'E4'],
    ],
    bass: ['F2', 'G2', 'E2', 'A2'],
    motif: ['C6', 'B5'],
  },
  {
    chords: [
      ['C3', 'E3', 'G3'], ['G3', 'B3', 'D4'],
      ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'],
    ],
    bass: ['C2', 'G2', 'A2', 'F2'],
    motif: ['G5', 'E5'],
  },
  {
    chords: [
      ['E3', 'G3', 'B3'], ['F3', 'A3', 'C4'],
      ['D3', 'F3', 'A3'], ['A3', 'C4', 'E4'],
    ],
    bass: ['E2', 'F2', 'D2', 'A2'],
    motif: ['B5', 'A5'],
  },
  {
    chords: [
      ['G3', 'B3', 'D4'], ['D3', 'F3', 'A3'],
      ['A3', 'C4', 'E4'], ['E3', 'G3', 'B3'],
    ],
    bass: ['G2', 'D2', 'A2', 'E2'],
    motif: ['D6', 'G5'],
  },
]

export function createSoundtrack({ Tone = ToneModule, random = Math.random }: { Tone?: SoundtrackTone; random?: () => number } = {}) {
  return new Soundtrack(Tone, random)
}

class Soundtrack {
  private _Tone: SoundtrackTone
  private _random: () => number
  private _nodes: { dispose(): unknown }[] = []
  private _repeatIds: number[] = []
  private _bar = 0
  private _startPromise: Promise<void> | null = null
  private _disposed = false
  private _graph: SoundGraph | null = null
  sceneIndex = 0
  started = false
  status: 'idle' | 'starting' | 'active' | 'stopped' | 'unavailable' = 'idle'
  constructor(Tone: SoundtrackTone, random: () => number) {
    this._Tone = Tone
    this._random = random
    this._nodes = []
    this._repeatIds = []
    this._bar = 0
    this._startPromise = null
    this._disposed = false
    this.sceneIndex = 0
    this.started = false
    this.status = 'idle'
  }

  start() {
    if (this._disposed) return Promise.resolve()
    if (!this._startPromise) this._startPromise = this._start()
    return this._startPromise
  }

  update(state: Pick<GameState, 'wave' | 'combo' | 'health'>, micEnergy = 0) {
    const graph = this._graph
    if (!this.started || !graph) return
    this._Tone.Transport.bpm.value = 80 + state.wave * 8
    const brightness = 500 + state.combo * 180 + micEnergy * 1600
    graph.filter.frequency.rampTo(brightness, 0.15)
    const danger = state.health <= 1 ? -3 : -8
    graph.master.volume.rampTo(danger + Math.min(4, state.combo - 1), 0.25)
  }

  handle(events: GameEvent[]) {
    const graph = this._graph
    if (!this.started || !graph) return
    for (const event of events) {
      if (event.type === 'collected') {
        const notes = ['A5', 'C6', 'E6', 'G6']
        graph.chime.triggerAttackRelease(notes[event.combo % notes.length], '16n')
      } else if (event.type === 'hit') {
        graph.noise.triggerAttackRelease('16n')
      } else if (event.type === 'pulse') {
        graph.pulse.triggerAttackRelease('A2', `${0.1 + event.strength * 0.35}`)
      } else if (event.type === 'event-warning') {
        graph.chime.triggerAttackRelease('C7', '16n')
      } else if (event.type === 'event-started') {
        graph.noise.triggerAttackRelease('8n')
      } else if (event.type === 'game-over') {
        graph.pad.triggerAttackRelease(['A2', 'C3', 'E3'], '1m')
      }
    }
  }

  dispose() {
    if (this._disposed) return
    this._disposed = true
    for (const repeatId of this._repeatIds) this._Tone.Transport.clear(repeatId)
    this._repeatIds.length = 0
    this._Tone.Transport.stop()
    this._Tone.Transport.cancel()
    for (const item of this._nodes) item.dispose()
    this._nodes.length = 0
    this._graph = null
    this.started = false
  }

  async _start() {
    this.status = 'starting'
    try {
      await this._Tone.start()
      if (this._disposed) {
        this.status = 'stopped'
        return
      }
      this._buildGraph()
      this._Tone.Transport.start()
      this.started = true
      this.status = 'active'
    } catch {
      this.status = 'unavailable'
    }
  }

  _buildGraph() {
    const Tone = this._Tone
    const limiter = this._keep(new Tone.Limiter(-2))
    limiter.toDestination()
    const reverb = this._keep(new Tone.Reverb({ decay: 5, wet: 0.48 }))
    const filter = this._keep(new Tone.Filter({ frequency: 900, type: 'lowpass' }))
    const master = this._keep(new Tone.Volume(-8))
    reverb.connect(limiter)
    filter.connect(reverb)
    master.connect(filter)

    const pad = this._keep(new Tone.PolySynth(Tone.FMSynth))
    const bass = this._keep(new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.03, decay: 0.3, sustain: 0.25, release: 1.1 },
    }))
    const chime = this._keep(new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.35, sustain: 0.05, release: 1.2 },
    }))
    const pulse = this._keep(new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 5,
      envelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 0.8 },
    }))
    const noise = this._keep(new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.005, decay: 0.16, sustain: 0 },
    }))
    pad.connect(master)
    bass.connect(master)
    chime.connect(master)
    pulse.connect(master)
    noise.connect(master)

    this._graph = { filter, master, pad, bass, chime, pulse, noise }
    this._repeatIds.push(Tone.Transport.scheduleRepeat(time => {
      if (this._bar > 0 && this._bar % 4 === 0) this._selectNextScene()
      const scene = HARMONIC_SCENES[this.sceneIndex]
      const step = this._bar % scene.chords.length
      pad.triggerAttackRelease(scene.chords[step], '2n', time)
      bass.triggerAttackRelease(scene.bass[step], '2n', time)
      if (step % 2 === 0) {
        chime.triggerAttackRelease(scene.motif[(step / 2) % scene.motif.length], '8n', time)
      }
      this._bar++
    }, '1m'))
  }

  _selectNextScene() {
    const options = HARMONIC_SCENES.length - 1
    let next = Math.floor(this._random() * options)
    if (next >= this.sceneIndex) next++
    this.sceneIndex = next
    this._bar = 0
  }

  private _keep<T extends { dispose(): unknown }>(node: T): T {
    this._nodes.push(node)
    return node
  }
}

import * as ToneModule from 'tone'

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

export function createSoundtrack({ Tone = ToneModule, random = Math.random } = {}) {
  return new Soundtrack(Tone, random)
}

class Soundtrack {
  constructor(Tone, random) {
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

  update(state, micEnergy = 0) {
    if (!this.started) return
    this._Tone.Transport.bpm.value = 80 + state.wave * 8
    const brightness = 500 + state.combo * 180 + micEnergy * 1600
    this._filter.frequency.rampTo(brightness, 0.15)
    const danger = state.health <= 1 ? -3 : -8
    this._master.volume.rampTo(danger + Math.min(4, state.combo - 1), 0.25)
  }

  handle(events) {
    if (!this.started) return
    for (const event of events) {
      if (event.type === 'collected') {
        const notes = ['A5', 'C6', 'E6', 'G6']
        this._chime.triggerAttackRelease(notes[event.combo % notes.length], '16n')
      } else if (event.type === 'hit') {
        this._noise.triggerAttackRelease('16n')
      } else if (event.type === 'pulse') {
        this._pulse.triggerAttackRelease('A2', `${0.1 + event.strength * 0.35}`)
      } else if (event.type === 'event-warning') {
        this._chime.triggerAttackRelease('C7', '16n')
      } else if (event.type === 'event-started') {
        this._noise.triggerAttackRelease('8n')
      } else if (event.type === 'game-over') {
        this._pad.triggerAttackRelease(['A2', 'C3', 'E3'], '1m')
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

    this._filter = filter
    this._master = master
    this._pad = pad
    this._bass = bass
    this._chime = chime
    this._pulse = pulse
    this._noise = noise
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

  _keep(node) {
    this._nodes.push(node)
    return node
  }
}

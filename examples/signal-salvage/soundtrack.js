import * as ToneModule from 'tone'

const CHORDS = [
  ['A3', 'C4', 'E4'],
  ['D3', 'A3', 'C4'],
  ['F3', 'A3', 'C4'],
  ['E3', 'G3', 'B3'],
]

export function createSoundtrack({ Tone = ToneModule } = {}) {
  return new Soundtrack(Tone)
}

class Soundtrack {
  constructor(Tone) {
    this._Tone = Tone
    this._nodes = []
    this._repeatId = null
    this._step = 0
    this._startPromise = null
    this._disposed = false
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
      } else if (event.type === 'game-over') {
        this._pad.triggerAttackRelease(['A2', 'C3', 'E3'], '1m')
      }
    }
  }

  dispose() {
    if (this._disposed) return
    this._disposed = true
    if (this._repeatId != null) this._Tone.Transport.clear(this._repeatId)
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
    chime.connect(master)
    pulse.connect(master)
    noise.connect(master)

    this._filter = filter
    this._master = master
    this._pad = pad
    this._chime = chime
    this._pulse = pulse
    this._noise = noise
    this._repeatId = Tone.Transport.scheduleRepeat(time => {
      pad.triggerAttackRelease(CHORDS[this._step % CHORDS.length], '2n', time)
      this._step++
    }, '1m')
  }

  _keep(node) {
    this._nodes.push(node)
    return node
  }
}

export const BPM = 112
export const BEATS_PER_BAR = 4
export const ROWS_PER_BEAT = 4
export const BARS_PER_PATTERN = 4
export const TOTAL_BARS = 48
export const SECONDS_PER_BEAT = 60 / BPM
export const DURATION = TOTAL_BARS * BEATS_PER_BAR * SECONDS_PER_BEAT

export const PARTS = [
  { id: 'invitation', name: 'INVITATION', startBar: 0, endBar: 8, source: 'Character.js', action: 'tend' },
  { id: 'break', name: 'THE LOOSE PIXEL', startBar: 8, endBar: 16, source: 'WinterWorld.js', action: 'pull' },
  { id: 'expansion', name: 'IMPOSSIBLE DEPTH', startBar: 16, endBar: 24, source: 'SwarmField.js', action: 'dive' },
  { id: 'reveal', name: 'LAMP / SUN / SWARM', startBar: 24, endBar: 32, source: 'SwarmField.js', action: 'conduct' },
  { id: 'climax', name: 'WHITEOUT ENGINE', startBar: 32, endBar: 42, source: 'WinterWorld.js', action: 'conduct' },
  { id: 'return', name: 'HOME SIGNAL', startBar: 42, endBar: 48, source: 'Character.js', action: 'bow' },
]

export function musicalPosition(seconds) {
  const safeSeconds = Math.max(0, Math.min(DURATION, Number(seconds) || 0))
  const absoluteBeat = safeSeconds / SECONDS_PER_BEAT
  const bar = Math.min(TOTAL_BARS - 1, Math.floor(absoluteBeat / BEATS_PER_BAR))
  const beat = Math.floor(absoluteBeat) % BEATS_PER_BAR
  const row = Math.floor(absoluteBeat * ROWS_PER_BEAT) % (BEATS_PER_BAR * ROWS_PER_BEAT)
  const pattern = Math.floor(bar / BARS_PER_PATTERN)
  const partIndex = Math.max(0, PARTS.findIndex(part => bar >= part.startBar && bar < part.endBar))
  const part = PARTS[partIndex]
  const partProgress = (absoluteBeat / BEATS_PER_BAR - part.startBar) / (part.endBar - part.startBar)
  return { seconds: safeSeconds, absoluteBeat, bar, beat, row, pattern, partIndex, part, partProgress }
}

export function stepAt(position) {
  const step = Math.floor(position.absoluteBeat * ROWS_PER_BEAT)
  const chord = Math.floor(position.bar / 2) % 4
  const melody = [0, 3, 7, 10, 7, 3, 12, 10, 7, 15, 12, 10, 7, 3, 5, 2][step % 16]
  return {
    step,
    chord,
    melody,
    kick: step % 16 === 0 || step % 16 === 8,
    snare: step % 16 === 4 || step % 16 === 12,
    hat: step % 2 === 0,
    bass: step % 4 === 0,
    chordHit: step % 16 === 0,
  }
}

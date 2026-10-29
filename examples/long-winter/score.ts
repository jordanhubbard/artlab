export const BPM = 110
export const BEATS_PER_BAR = 4
export const ROWS_PER_BEAT = 4
export const BARS_PER_PATTERN = 2
export const TOTAL_BARS = 56
export const SECONDS_PER_BEAT = 60 / BPM
export const DURATION = TOTAL_BARS * BEATS_PER_BAR * SECONDS_PER_BEAT

const SONGS = {
  'blue-hour': {
    title: 'BLÅ TIMMEN', voice: 'bell',
    chords: [['D3', 'F3', 'A3'], ['Bb2', 'D3', 'F3'], ['F3', 'A3', 'C4'], ['C3', 'E3', 'G3']], bass: ['D2', 'Bb1', 'F2', 'C2'],
    melody: ['A4', null, 'D5', null, 'F5', null, 'E5', null, 'D5', null, 'A4', null, 'C5', null, 'D5', null],
    kick: [0, 10], snare: [], hats: [6, 14], chordRows: [0], melodyRows: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  'hearth-song': {
    title: 'ELD I SNÖN', voice: 'pluck',
    chords: [['G3', 'B3', 'D4'], ['D3', 'F#3', 'A3'], ['E3', 'G3', 'B3'], ['C3', 'E3', 'G3']], bass: ['G2', 'D2', 'E2', 'C2'],
    melody: ['G5', 'B5', 'D6', 'B5', 'A5', 'F#5', 'D5', 'F#5', 'E5', 'G5', 'B5', 'G5', 'E5', 'D5', 'C5', 'D5'],
    kick: [0, 8], snare: [4, 12], hats: [2, 6, 10, 14], chordRows: [0, 8], melodyRows: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  'fjord-mirror': {
    title: 'FJORD MIRROR', voice: 'bell',
    chords: [['E3', 'G3', 'B3'], ['C3', 'E3', 'G3'], ['A2', 'C3', 'E3'], ['B2', 'D#3', 'F#3']], bass: ['E2', 'C2', 'A1', 'B1'],
    melody: ['B4', null, null, 'E5', null, null, 'G5', null, 'F#5', null, null, 'D5', null, 'B4', null, null],
    kick: [0], snare: [12], hats: [], chordRows: [0], melodyRows: [0, 3, 6, 8, 11, 13],
  },
  'aurora-code': {
    title: 'AURORA CODE', voice: 'chip',
    chords: [['F#3', 'A3', 'C#4'], ['E3', 'G#3', 'B3'], ['B3', 'D4', 'F#4'], ['C#3', 'E3', 'G#3']], bass: ['F#2', 'E2', 'B2', 'C#2'],
    melody: ['F#5', 'A5', 'C#6', 'E6', 'C#6', 'A5', 'F#5', 'E5', 'B5', 'D6', 'F#6', 'A6', 'F#6', 'D6', 'B5', 'G#5'],
    kick: [0, 6, 8, 14], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14], chordRows: [0, 8], melodyRows: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  'birch-run': {
    title: 'BIRCH RUN', voice: 'pluck',
    chords: [['A3', 'C4', 'E4'], ['G3', 'B3', 'D4'], ['F3', 'A3', 'C4'], ['E3', 'G#3', 'B3']], bass: ['A2', 'G2', 'F2', 'E2'],
    melody: ['A5', 'E5', 'C6', 'E5', 'G5', 'D5', 'B5', 'D5', 'F5', 'C5', 'A5', 'C5', 'E5', 'B4', 'G#5', 'B4'],
    kick: [0, 3, 8, 11], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14], chordRows: [0, 4, 8, 12], melodyRows: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  'loose-pixel': {
    title: 'THE LOOSE PIXEL', voice: 'chip',
    chords: [['C3', 'Eb3', 'G3'], ['Db3', 'F3', 'Ab3'], ['A2', 'C3', 'E3'], ['B2', 'D3', 'F#3']], bass: ['C2', 'Db2', 'A1', 'B1'],
    melody: ['C6', null, 'B5', 'Bb5', 'A5', null, 'Ab5', 'G5', 'F#5', null, 'F5', 'E5', 'Eb5', 'D5', 'Db5', 'C5'],
    kick: [0, 7, 8, 15], snare: [4, 12], hats: [1, 3, 5, 7, 9, 11, 13, 15], chordRows: [0, 8], melodyRows: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 13, 14, 15],
  },
  'copper-tunnel': {
    title: 'COPPER TUNNEL', voice: 'chip',
    chords: [['E3', 'G#3', 'B3'], ['A3', 'C#4', 'E4'], ['C#3', 'E3', 'G#3'], ['B2', 'D#3', 'F#3']], bass: ['E2', 'A2', 'C#2', 'B1'],
    melody: ['E6', 'B5', 'G#5', 'B5', 'A5', 'E6', 'C#6', 'E6', 'G#6', 'E6', 'C#6', 'B5', 'F#6', 'D#6', 'B5', 'F#5'],
    kick: [0, 4, 8, 11], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14], chordRows: [0, 4, 8, 12], melodyRows: [0, 1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 14],
  },
  'color-storm': {
    title: 'SILVER BLOOM', voice: 'chip',
    chords: [['C3', 'Eb3', 'G3'], ['Ab2', 'C3', 'Eb3'], ['F3', 'Ab3', 'C4'], ['G3', 'B3', 'D4']], bass: ['C2', 'Ab1', 'F2', 'G2'],
    melody: ['C6', 'G5', 'Eb6', 'G5', 'Ab5', 'Eb6', 'C6', 'Eb6', 'F6', 'C6', 'Ab5', 'C6', 'G6', 'D6', 'B5', 'D6'],
    kick: [0, 3, 6, 8, 11, 14], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14], chordRows: [0, 4, 8, 12], melodyRows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  },
  'first-light': {
    title: 'FÖRSTA LJUS', voice: 'bell',
    chords: [['D3', 'F#3', 'A3'], ['G3', 'B3', 'D4'], ['B2', 'D3', 'F#3'], ['A2', 'C#3', 'E3']], bass: ['D2', 'G2', 'B1', 'A1'],
    melody: ['D5', null, 'F#5', 'A5', null, 'B5', 'A5', null, 'G5', null, 'F#5', 'E5', null, 'C#5', 'D5', null],
    kick: [0, 8], snare: [12], hats: [2, 6, 10, 14], chordRows: [0], melodyRows: [0, 2, 3, 5, 6, 8, 10, 11, 13, 14],
  },
}

export const ACTS = [
  { id: 'blue-hour', name: 'I · BLUE HOUR', startBar: 0, endBar: 6, source: 'NordicLandscape.js', action: 'tend' },
  { id: 'hearth-song', name: 'II · FIRE IN THE SNOW', startBar: 6, endBar: 12, source: 'NordicLandscape.js', action: 'wave' },
  { id: 'fjord-mirror', name: 'III · FJORD MIRROR', startBar: 12, endBar: 18, source: 'NordicLandscape.js', action: 'watch' },
  { id: 'aurora-code', name: 'IV · AURORA CODE', startBar: 18, endBar: 24, source: 'NordicLandscape.js', action: 'conduct' },
  { id: 'birch-run', name: 'V · BIRCH RUN', startBar: 24, endBar: 30, source: 'NordicLandscape.js', action: 'run' },
  { id: 'loose-pixel', name: 'VI · THE LOOSE PIXEL', startBar: 30, endBar: 36, source: 'WinterWorld.js', action: 'pull' },
  { id: 'copper-tunnel', name: 'VII · COPPER TUNNEL', startBar: 36, endBar: 42, source: 'DemoGraphics.js', action: 'dive' },
  { id: 'color-storm', name: 'VIII · SILVER BLOOM', startBar: 42, endBar: 50, source: 'DemoGraphics.js', action: 'conduct' },
  { id: 'first-light', name: 'IX · FIRST LIGHT', startBar: 50, endBar: 56, source: 'NordicLandscape.js', action: 'bow' },
].map(act => ({ ...act, song: SONGS[act.id] }))

export const PARTS = ACTS

export function musicalPosition(seconds) {
  const safeSeconds = Math.max(0, Math.min(DURATION, Number(seconds) || 0))
  const absoluteBeat = safeSeconds / SECONDS_PER_BEAT
  const bar = Math.min(TOTAL_BARS - 1, Math.floor(absoluteBeat / BEATS_PER_BAR))
  const beat = Math.floor(absoluteBeat) % BEATS_PER_BAR
  const row = Math.floor(absoluteBeat * ROWS_PER_BEAT) % (BEATS_PER_BAR * ROWS_PER_BEAT)
  const pattern = Math.floor(bar / BARS_PER_PATTERN)
  const actIndex = Math.max(0, ACTS.findIndex(act => bar >= act.startBar && bar < act.endBar))
  const act = ACTS[actIndex]
  const localBeat = absoluteBeat - act.startBar * BEATS_PER_BAR
  const actProgress = localBeat / ((act.endBar - act.startBar) * BEATS_PER_BAR)
  return { seconds: safeSeconds, absoluteBeat, bar, beat, row, pattern, actIndex, act, actProgress, partIndex: actIndex, part: act, partProgress: actProgress }
}

export function stepAt(position) {
  const localStep = Math.floor((position.absoluteBeat - position.act.startBar * BEATS_PER_BAR) * ROWS_PER_BEAT)
  const row = ((localStep % 16) + 16) % 16
  const chordIndex = Math.floor(localStep / 16) % position.act.song.chords.length
  const song = position.act.song
  return {
    step: Math.floor(position.absoluteBeat * ROWS_PER_BEAT), localStep, row,
    melodyNote: song.melody[row], chord: song.chords[chordIndex], bassNote: song.bass[chordIndex],
    kick: song.kick.includes(row), snare: song.snare.includes(row), hat: song.hats.includes(row),
    bass: row % 4 === 0, chordHit: song.chordRows.includes(row),
    melody: song.melodyRows.includes(row) && Boolean(song.melody[row]),
  }
}

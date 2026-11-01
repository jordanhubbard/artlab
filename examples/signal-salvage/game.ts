export const GAME_DURATION = 90
export const MAX_FRAGMENTS = 28
export const MAX_HAZARDS = 16

export type CollectibleKind = 'memory' | 'resonance' | 'prism' | 'repair'
export type HazardKind = 'gravity' | 'debris' | 'corruption'
export type ChaosType = 'debris-stream' | 'corruption-swarm' | 'gravity-well' | 'blackout' | 'signal-storm'
interface EntityPosition { id: number; x: number; y: number; z: number; active: boolean }
export type Fragment = EntityPosition & { type?: 'fragment'; kind?: CollectibleKind }
export type Hazard = EntityPosition & { type?: 'hazard'; kind?: HazardKind }
interface EventDefinition { type: ChaosType; duration: number; incompatible?: ChaosType[] }
export type GameEvent =
  | { type: 'pulse'; strength: number }
  | { type: 'collected'; kind?: CollectibleKind; combo: number }
  | { type: 'hit'; health: number }
  | { type: 'event-warning' | 'event-started' | 'event-ended'; event: ChaosType }
  | { type: 'game-over' }
export interface GameInput {
  x?: number; y?: number; pulseHeld?: boolean; pulseReleased?: boolean; micEnergy?: number;
}
export interface GameState {
  phase: 'ready' | 'playing' | 'paused' | 'game-over'; random: () => number;
  timeRemaining: number; wave: number; score: number; combo: number; comboFor: number;
  health: number; pulseCharge: number; pulseFor: number; resonanceFor: number;
  scoreMultiplier: number; scoreMultiplierFor: number; invulnerableFor: number;
  player: { x: number; y: number }; fragments: Fragment[]; hazards: Hazard[];
  spawnFragmentIn: number; spawnHazardIn: number;
  activeEvents: { type: ChaosType; remaining: number }[];
  eventWarning: ChaosType | null; eventWarningFor: number; pendingEvent: ChaosType | null;
  nextEventIn: number; nextEntityId: number;
}

const PLAYER_SPEED = 6
const X_LIMIT = 6
const Y_LIMIT = 3.5
const COLLISION_RADIUS = 0.85
const COMBO_WINDOW = 3
const EVENT_WARNING_TIME = 1.5
const EVENT_INTERVAL_MIN = 6
const EVENT_INTERVAL_RANGE = 6
// The opening anomaly is deliberately not random: players need to see one
// telegraph land early to learn what the warning line means.
const FIRST_EVENT_LEAD = EVENT_INTERVAL_MIN - EVENT_WARNING_TIME
const EVENT_DEFINITIONS: EventDefinition[] = [
  { type: 'debris-stream', duration: 5 },
  { type: 'corruption-swarm', duration: 6 },
  { type: 'gravity-well', duration: 6 },
  { type: 'blackout', duration: 5, incompatible: ['signal-storm'] },
  { type: 'signal-storm', duration: 7, incompatible: ['blackout'] },
]

export function createGame({ random = Math.random } = {}): GameState {
  return {
    phase: 'ready',
    random,
    timeRemaining: GAME_DURATION,
    wave: 1,
    score: 0,
    combo: 1,
    comboFor: 0,
    health: 3,
    pulseCharge: 0,
    pulseFor: 0,
    resonanceFor: 0,
    scoreMultiplier: 1,
    scoreMultiplierFor: 0,
    invulnerableFor: 0,
    player: { x: 0, y: 0 },
    fragments: [],
    hazards: [],
    spawnFragmentIn: 0,
    spawnHazardIn: 1.5,
    activeEvents: [],
    eventWarning: null,
    eventWarningFor: 0,
    pendingEvent: null,
    nextEventIn: FIRST_EVENT_LEAD,
    nextEntityId: 1,
  }
}

export function startGame(state: GameState) {
  resetMission(state)
  state.phase = 'playing'
  return state
}

export function restartGame(state: GameState) {
  return startGame(state)
}

export function togglePause(state: GameState) {
  if (state.phase === 'playing') state.phase = 'paused'
  else if (state.phase === 'paused') state.phase = 'playing'
  return state.phase
}

export function stepGame(state: GameState, input: GameInput, dt: number): GameEvent[] {
  if (state.phase !== 'playing' || dt <= 0) return []

  const events: GameEvent[] = []
  updateMissionClock(state, dt, events)
  if (state.phase !== 'playing') return events

  updatePlayer(state, input, dt)
  updatePulse(state, input, dt, events)
  updateTimers(state, dt)
  updateChaosDirector(state, dt, events)
  spawnEntities(state, dt)
  advanceEntities(state, dt)
  resolveCollisions(state, events)
  removeExpiredEntities(state)
  return events
}

function resetMission(state: GameState) {
  state.timeRemaining = GAME_DURATION
  state.wave = 1
  state.score = 0
  state.combo = 1
  state.comboFor = 0
  state.health = 3
  state.pulseCharge = 0
  state.pulseFor = 0
  state.resonanceFor = 0
  state.scoreMultiplier = 1
  state.scoreMultiplierFor = 0
  state.invulnerableFor = 0
  state.player.x = 0
  state.player.y = 0
  state.fragments.length = 0
  state.hazards.length = 0
  state.spawnFragmentIn = 0
  state.spawnHazardIn = 1.5
  state.activeEvents.length = 0
  state.eventWarning = null
  state.eventWarningFor = 0
  state.pendingEvent = null
  state.nextEventIn = FIRST_EVENT_LEAD
  state.nextEntityId = 1
}

function updateMissionClock(state: GameState, dt: number, events: GameEvent[]) {
  state.timeRemaining = Math.max(0, state.timeRemaining - dt)
  const elapsed = GAME_DURATION - state.timeRemaining
  state.wave = elapsed < 30 ? 1 : elapsed < 60 ? 2 : 3
  if (state.timeRemaining === 0) endGame(state, events)
}

function updatePlayer(state: GameState, input: GameInput, dt: number) {
  const x = clamp(Number(input.x) || 0, -1, 1)
  const y = clamp(Number(input.y) || 0, -1, 1)
  state.player.x = clamp(state.player.x + x * PLAYER_SPEED * dt, -X_LIMIT, X_LIMIT)
  state.player.y = clamp(state.player.y + y * PLAYER_SPEED * dt, -Y_LIMIT, Y_LIMIT)
}

function updatePulse(state: GameState, input: GameInput, dt: number, events: GameEvent[]) {
  if (input.pulseHeld) {
    const micBoost = clamp(Number(input.micEnergy) || 0, 0, 1)
    state.pulseCharge = clamp(state.pulseCharge + dt * (0.7 + micBoost), 0, 1)
  }

  if (input.pulseReleased && state.pulseCharge >= 0.2) {
    const resonance = state.resonanceFor > 0 ? 1.35 : 1
    const strength = clamp(state.pulseCharge * resonance, 0, 1.35)
    state.pulseCharge = 0
    state.pulseFor = 0.45
    applyPulse(state, strength)
    events.push({ type: 'pulse', strength })
  }
}

function applyPulse(state: GameState, strength: number) {
  for (const fragment of state.fragments) {
    if (fragment.z > -12) {
      fragment.x += (state.player.x - fragment.x) * strength * 0.7
      fragment.y += (state.player.y - fragment.y) * strength * 0.7
    }
  }
  for (const hazard of state.hazards) {
    if (hazard.z > -12) {
      let dx = hazard.x - state.player.x
      let dy = hazard.y - state.player.y
      const distance = Math.hypot(dx, dy)
      if (distance === 0) {
        dx = 1
        dy = 0
      } else {
        dx /= distance
        dy /= distance
      }
      hazard.x += dx * strength * 3
      hazard.y += dy * strength * 3
      hazard.z -= strength * 5
    }
  }
}

function updateTimers(state: GameState, dt: number) {
  state.comboFor = Math.max(0, state.comboFor - dt)
  if (state.comboFor === 0) state.combo = 1
  state.invulnerableFor = Math.max(0, state.invulnerableFor - dt)
  state.pulseFor = Math.max(0, state.pulseFor - dt)
  state.resonanceFor = Math.max(0, state.resonanceFor - dt)
  state.scoreMultiplierFor = Math.max(0, state.scoreMultiplierFor - dt)
  if (state.scoreMultiplierFor === 0) state.scoreMultiplier = 1
}

function updateChaosDirector(state: GameState, dt: number, events: GameEvent[]) {
  for (const event of state.activeEvents) event.remaining -= dt
  const ended = state.activeEvents.filter(event => event.remaining <= 0)
  state.activeEvents = state.activeEvents.filter(event => event.remaining > 0)
  for (const event of ended) events.push({ type: 'event-ended', event: event.type })

  if (state.pendingEvent) {
    state.eventWarningFor = Math.max(0, state.eventWarningFor - dt)
    if (state.eventWarningFor === 0) {
      const definition = EVENT_DEFINITIONS.find(item => item.type === state.pendingEvent)
      if (!definition) throw new Error(`Unknown anomaly: ${state.pendingEvent}`)
      state.activeEvents.push({ type: definition.type, remaining: definition.duration })
      events.push({ type: 'event-started', event: definition.type })
      state.pendingEvent = null
      state.eventWarning = null
      state.nextEventIn = nextWarningDelay(state)
    }
    return
  }

  state.nextEventIn -= dt
  if (state.nextEventIn > 0 || state.activeEvents.length >= 2) return
  const candidates = EVENT_DEFINITIONS.filter(definition => isCompatible(state, definition))
  const selected = candidates[Math.min(
    candidates.length - 1,
    Math.floor(state.random() * candidates.length),
  )]
  state.pendingEvent = selected.type
  state.eventWarning = selected.type
  state.eventWarningFor = EVENT_WARNING_TIME
  events.push({ type: 'event-warning', event: selected.type })
}

function isCompatible(state: GameState, candidate: EventDefinition) {
  return state.activeEvents.every(active => {
    const definition = EVENT_DEFINITIONS.find(item => item.type === active.type)
    return !candidate.incompatible?.includes(active.type)
      && !definition?.incompatible?.includes(candidate.type)
  })
}

function spawnEntities(state: GameState, dt: number) {
  state.spawnFragmentIn -= dt
  state.spawnHazardIn -= dt

  if (state.spawnFragmentIn <= 0 && state.fragments.length < MAX_FRAGMENTS) {
    state.fragments.push(createEntity(state, 'fragment'))
    const stormRate = hasEvent(state, 'signal-storm') ? 0.55 : 1
    state.spawnFragmentIn = [0.7, 0.52, 0.38][state.wave - 1] * stormRate
  }
  if (state.spawnHazardIn <= 0 && state.hazards.length < MAX_HAZARDS) {
    state.hazards.push(createEntity(state, 'hazard'))
    const swarmRate = hasEvent(state, 'corruption-swarm') ? 0.48 : 1
    const debrisRate = hasEvent(state, 'debris-stream') ? 0.62 : 1
    state.spawnHazardIn = [2.2, 1.55, 1.05][state.wave - 1] * swarmRate * debrisRate
  }
}

function createEntity(state: GameState, type: 'fragment'): Fragment
function createEntity(state: GameState, type: 'hazard'): Hazard
function createEntity(state: GameState, type: 'fragment' | 'hazard'): Fragment | Hazard {
  const id = state.nextEntityId++
  const species = type === 'fragment'
    ? { type, kind: chooseCollectible(state.random()) }
    : { type, kind: chooseHazard(state.random()) }
  return {
    id,
    ...species,
    x: (state.random() * 2 - 1) * X_LIMIT,
    y: (state.random() * 2 - 1) * Y_LIMIT,
    z: -42 - state.random() * 12,
    active: true,
  }
}

function advanceEntities(state: GameState, dt: number) {
  const stormSpeed = hasEvent(state, 'signal-storm') ? 1.45 : 1
  const speed = [10, 13, 16][state.wave - 1] * stormSpeed
  for (const entity of state.fragments) entity.z += speed * dt
  for (const entity of state.hazards) entity.z += speed * dt
  if (hasEvent(state, 'gravity-well')) {
    const pull = Math.max(0, 1 - dt * 0.35)
    for (const entity of state.fragments) {
      entity.x *= pull
      entity.y *= pull
    }
    for (const entity of state.hazards) {
      entity.x *= pull
      entity.y *= pull
    }
  }
}

function resolveCollisions(state: GameState, events: GameEvent[]) {
  for (const fragment of state.fragments) {
    if (!fragment.active || !collides(state, fragment)) continue
    fragment.active = false
    const explicitKind = fragment.kind
    const kind = explicitKind ?? 'memory'
    const points = { memory: 100, resonance: 125, prism: 150, repair: 50 }[kind]
    state.score += points * state.combo * state.scoreMultiplier
    applyCollectibleReward(state, kind)
    state.combo = Math.min(8, state.combo + 1)
    state.comboFor = COMBO_WINDOW
    events.push(explicitKind
      ? { type: 'collected', kind, combo: state.combo }
      : { type: 'collected', combo: state.combo })
  }

  if (state.invulnerableFor > 0) return
  for (const hazard of state.hazards) {
    if (!hazard.active || !collides(state, hazard)) continue
    hazard.active = false
    state.health = Math.max(0, state.health - 1)
    state.combo = 1
    state.comboFor = 0
    state.invulnerableFor = 1
    events.push({ type: 'hit', health: state.health })
    if (state.health === 0) endGame(state, events)
    break
  }
}

function applyCollectibleReward(state: GameState, kind: CollectibleKind) {
  if (kind === 'resonance') {
    state.resonanceFor = 8
  } else if (kind === 'prism') {
    state.scoreMultiplier = 2
    state.scoreMultiplierFor = 6
  } else if (kind === 'repair') {
    state.health = Math.min(3, state.health + 1)
  }
}

function chooseCollectible(value: number): CollectibleKind {
  if (value > 0.94) return 'repair'
  if (value > 0.72) return 'prism'
  if (value > 0.48) return 'resonance'
  return 'memory'
}

function chooseHazard(value: number): HazardKind {
  if (value > 0.78) return 'gravity'
  if (value > 0.42) return 'debris'
  return 'corruption'
}

function hasEvent(state: GameState, type: ChaosType) {
  return state.activeEvents.some(event => event.type === type)
}

function nextWarningDelay(state: GameState) {
  return EVENT_INTERVAL_MIN - EVENT_WARNING_TIME + state.random() * EVENT_INTERVAL_RANGE
}

function collides(state: GameState, entity: EntityPosition) {
  const dx = entity.x - state.player.x
  const dy = entity.y - state.player.y
  return dx * dx + dy * dy + entity.z * entity.z <= COLLISION_RADIUS * COLLISION_RADIUS
}

function removeExpiredEntities(state: GameState) {
  state.fragments = state.fragments.filter(entity => entity.active && entity.z < 4)
  state.hazards = state.hazards.filter(entity => entity.active && entity.z < 4)
}

function endGame(state: GameState, events: GameEvent[]) {
  if (state.phase === 'game-over') return
  state.phase = 'game-over'
  events.push({ type: 'game-over' })
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

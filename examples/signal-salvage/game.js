export const GAME_DURATION = 90
export const MAX_FRAGMENTS = 28
export const MAX_HAZARDS = 16

const PLAYER_SPEED = 6
const X_LIMIT = 6
const Y_LIMIT = 3.5
const COLLISION_RADIUS = 0.85
const COMBO_WINDOW = 3

export function createGame({ random = Math.random } = {}) {
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
    invulnerableFor: 0,
    player: { x: 0, y: 0 },
    fragments: [],
    hazards: [],
    spawnFragmentIn: 0,
    spawnHazardIn: 1.5,
    nextEntityId: 1,
  }
}

export function startGame(state) {
  resetMission(state)
  state.phase = 'playing'
  return state
}

export function restartGame(state) {
  return startGame(state)
}

export function togglePause(state) {
  if (state.phase === 'playing') state.phase = 'paused'
  else if (state.phase === 'paused') state.phase = 'playing'
  return state.phase
}

export function stepGame(state, input, dt) {
  if (state.phase !== 'playing' || dt <= 0) return []

  const events = []
  updateMissionClock(state, dt, events)
  if (state.phase !== 'playing') return events

  updatePlayer(state, input, dt)
  updatePulse(state, input, dt, events)
  updateTimers(state, dt)
  spawnEntities(state, dt)
  advanceEntities(state, dt)
  resolveCollisions(state, events)
  removeExpiredEntities(state)
  return events
}

function resetMission(state) {
  state.timeRemaining = GAME_DURATION
  state.wave = 1
  state.score = 0
  state.combo = 1
  state.comboFor = 0
  state.health = 3
  state.pulseCharge = 0
  state.pulseFor = 0
  state.invulnerableFor = 0
  state.player.x = 0
  state.player.y = 0
  state.fragments.length = 0
  state.hazards.length = 0
  state.spawnFragmentIn = 0
  state.spawnHazardIn = 1.5
  state.nextEntityId = 1
}

function updateMissionClock(state, dt, events) {
  state.timeRemaining = Math.max(0, state.timeRemaining - dt)
  const elapsed = GAME_DURATION - state.timeRemaining
  state.wave = elapsed < 30 ? 1 : elapsed < 60 ? 2 : 3
  if (state.timeRemaining === 0) endGame(state, events)
}

function updatePlayer(state, input, dt) {
  const x = clamp(Number(input.x) || 0, -1, 1)
  const y = clamp(Number(input.y) || 0, -1, 1)
  state.player.x = clamp(state.player.x + x * PLAYER_SPEED * dt, -X_LIMIT, X_LIMIT)
  state.player.y = clamp(state.player.y + y * PLAYER_SPEED * dt, -Y_LIMIT, Y_LIMIT)
}

function updatePulse(state, input, dt, events) {
  if (input.pulseHeld) {
    const micBoost = clamp(Number(input.micEnergy) || 0, 0, 1)
    state.pulseCharge = clamp(state.pulseCharge + dt * (0.7 + micBoost), 0, 1)
  }

  if (input.pulseReleased && state.pulseCharge >= 0.2) {
    const strength = state.pulseCharge
    state.pulseCharge = 0
    state.pulseFor = 0.45
    applyPulse(state, strength)
    events.push({ type: 'pulse', strength })
  }
}

function applyPulse(state, strength) {
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

function updateTimers(state, dt) {
  state.comboFor = Math.max(0, state.comboFor - dt)
  if (state.comboFor === 0) state.combo = 1
  state.invulnerableFor = Math.max(0, state.invulnerableFor - dt)
  state.pulseFor = Math.max(0, state.pulseFor - dt)
}

function spawnEntities(state, dt) {
  state.spawnFragmentIn -= dt
  state.spawnHazardIn -= dt

  if (state.spawnFragmentIn <= 0 && state.fragments.length < MAX_FRAGMENTS) {
    state.fragments.push(createEntity(state, 'fragment'))
    state.spawnFragmentIn = [0.7, 0.52, 0.38][state.wave - 1]
  }
  if (state.spawnHazardIn <= 0 && state.hazards.length < MAX_HAZARDS) {
    state.hazards.push(createEntity(state, 'hazard'))
    state.spawnHazardIn = [2.2, 1.55, 1.05][state.wave - 1]
  }
}

function createEntity(state, type) {
  return {
    id: state.nextEntityId++,
    type,
    x: (state.random() * 2 - 1) * X_LIMIT,
    y: (state.random() * 2 - 1) * Y_LIMIT,
    z: -42 - state.random() * 12,
    active: true,
  }
}

function advanceEntities(state, dt) {
  const speed = [10, 13, 16][state.wave - 1]
  for (const entity of state.fragments) entity.z += speed * dt
  for (const entity of state.hazards) entity.z += speed * dt
}

function resolveCollisions(state, events) {
  for (const fragment of state.fragments) {
    if (!fragment.active || !collides(state, fragment)) continue
    fragment.active = false
    state.score += 100 * state.combo
    state.combo = Math.min(8, state.combo + 1)
    state.comboFor = COMBO_WINDOW
    events.push({ type: 'collected', combo: state.combo })
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

function collides(state, entity) {
  const dx = entity.x - state.player.x
  const dy = entity.y - state.player.y
  return dx * dx + dy * dy + entity.z * entity.z <= COLLISION_RADIUS * COLLISION_RADIUS
}

function removeExpiredEntities(state) {
  state.fragments = state.fragments.filter(entity => entity.active && entity.z < 4)
  state.hazards = state.hazards.filter(entity => entity.active && entity.z < 4)
}

function endGame(state, events) {
  if (state.phase === 'game-over') return
  state.phase = 'game-over'
  events.push({ type: 'game-over' })
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

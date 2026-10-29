// Gravity-assist camera journey.
//
// The planets keep their Keplerian simulation in solar-system.js. This module
// treats the camera as the spacecraft and continuously computes a fly-by path
// from the live planet positions, so course changes affect only the viewpoint.

const AU_SCALE = 100
const PLUTO_TRANSFER_AU = 39.48
const BEYOND_AU = 56
const EPS = 1e-6

const FLYBY_PLAN = [
  { name: 'mercury', label: 'Mercury', duration: 11, pass: 16, lift: 5, speed: 48 },
  { name: 'venus', label: 'Venus', duration: 12, pass: 20, lift: 7, speed: 55 },
  { name: 'earth', label: 'Earth', duration: 13, pass: 22, lift: 8, speed: 63 },
  { name: 'mars', label: 'Mars', duration: 14, pass: 18, lift: 9, speed: 71 },
  { name: 'jupiter', label: 'Jupiter', duration: 17, pass: 105, lift: 30, speed: 89 },
  { name: 'saturn', label: 'Saturn', duration: 18, pass: 98, lift: 38, speed: 104 },
  { name: 'uranus', label: 'Uranus', duration: 20, pass: 55, lift: 48, speed: 118 },
  { name: 'neptune', label: 'Neptune', duration: 21, pass: 58, lift: 54, speed: 130 },
  { name: 'pluto-transfer', label: 'Pluto transfer', duration: 20, pass: 90, lift: 90, speed: 140 },
  { name: 'beyond', label: 'Beyond Pluto', duration: 16, pass: 130, lift: 140, speed: 148 },
]

const START_SPEED = 42
const START_TIMES = []
let total = 0
for (const leg of FLYBY_PLAN) {
  START_TIMES.push(total)
  total += leg.duration
}
const TOTAL_DURATION = total

const FALLBACK_POSITIONS = {
  mercury: [0.387 * AU_SCALE, 0, 0],
  venus: [0.723 * AU_SCALE, 0, 0],
  earth: [1.000 * AU_SCALE, 0, 0],
  mars: [1.524 * AU_SCALE, 0, 0],
  jupiter: [5.204 * AU_SCALE, 0, 0],
  saturn: [9.537 * AU_SCALE, 0, 0],
  uranus: [19.19 * AU_SCALE, 0, 0],
  neptune: [30.07 * AU_SCALE, 0, 0],
}

export const FLYBY_TARGETS = FLYBY_PLAN.map(leg => leg.name)

function v3(ctx, x = 0, y = 0, z = 0) {
  return new ctx.Three.Vector3(x, y, z)
}

function clamp01(t) {
  return Math.min(1, Math.max(0, t))
}

function smoothstep(t) {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

function lerpValue(a, b, t) {
  return a + (b - a) * t
}

function lerpVector(ctx, a, b, t) {
  return v3(ctx).lerpVectors(a, b, smoothstep(t))
}

function safeUnit(ctx, vec, fallback = null) {
  if (vec.lengthSq() > EPS) return vec.clone().normalize()
  if (fallback && fallback.lengthSq() > EPS) return fallback.clone().normalize()
  return v3(ctx, 1, 0, 0)
}

function sideFromOutward(ctx, outward) {
  const side = v3(ctx, -outward.z, 0, outward.x)
  return safeUnit(ctx, side, v3(ctx, 0, 0, 1))
}

function plutoTransferPosition(ctx) {
  const neptune = bodyPosition(ctx, 'neptune')
  const outward = safeUnit(ctx, neptune, v3(ctx, 1, 0, 0))
  const side = sideFromOutward(ctx, outward)
  return outward.multiplyScalar(PLUTO_TRANSFER_AU * AU_SCALE)
    .add(side.multiplyScalar(420))
    .add(v3(ctx, 0, 340, 0))
}

function beyondPosition(ctx) {
  const transfer = plutoTransferPosition(ctx)
  const outward = safeUnit(ctx, transfer, v3(ctx, 1, 0, 0))
  const side = sideFromOutward(ctx, outward)
  return outward.multiplyScalar(BEYOND_AU * AU_SCALE)
    .add(side.multiplyScalar(900))
    .add(v3(ctx, 0, 760, 0))
}

function bodyPosition(ctx, name) {
  if (name === 'sun') return v3(ctx, 0, 0, 0)
  if (name === 'pluto-transfer') return plutoTransferPosition(ctx)
  if (name === 'beyond') return beyondPosition(ctx)

  const live = ctx._planets?.[name]?.position
  if (live && live.lengthSq() > EPS) return live.clone()

  const fallback = FALLBACK_POSITIONS[name] ?? [0, 0, 0]
  return v3(ctx, fallback[0], fallback[1], fallback[2])
}

function launchPoint(ctx) {
  const mercury = bodyPosition(ctx, 'mercury')
  const outward = safeUnit(ctx, mercury, v3(ctx, 1, 0, 0))
  const side = sideFromOutward(ctx, outward)
  return outward.multiplyScalar(24)
    .add(side.multiplyScalar(8))
    .add(v3(ctx, 0, 8, 0))
}

function legIndexForTime(time) {
  for (let i = FLYBY_PLAN.length - 1; i >= 0; i--) {
    if (time >= START_TIMES[i]) return i
  }
  return 0
}

function frameForLeg(ctx, index) {
  const leg = FLYBY_PLAN[index]
  const prev = FLYBY_PLAN[index - 1]
  const next = FLYBY_PLAN[index + 1]

  const target = bodyPosition(ctx, leg.name)
  const origin = prev ? exitPointForLeg(ctx, index - 1) : launchPoint(ctx)
  const nextPos = next ? bodyPosition(ctx, next.name) : beyondPosition(ctx)

  const inbound = safeUnit(ctx, target.clone().sub(origin), safeUnit(ctx, target, v3(ctx, 1, 0, 0)))
  const outbound = safeUnit(ctx, nextPos.clone().sub(target), inbound)

  let normal = inbound.clone().cross(outbound)
  if (normal.lengthSq() <= EPS) normal = inbound.clone().cross(v3(ctx, 0, 1, 0))
  if (normal.lengthSq() <= EPS) normal = inbound.clone().cross(v3(ctx, 0, 0, 1))
  normal = safeUnit(ctx, normal)
  if (index % 2) normal.multiplyScalar(-1)

  const side = safeUnit(ctx, normal.clone().cross(inbound), sideFromOutward(ctx, safeUnit(ctx, target, inbound)))
  const up = safeUnit(ctx, side.clone().cross(inbound), v3(ctx, 0, 1, 0))
  const pass = leg.pass
  const lift = leg.lift
  const approachDistance = Math.max(pass * 4.5, Math.min(origin.distanceTo(target) * 0.32, 760))
  const exitDistance = Math.max(pass * 5.0, Math.min(target.distanceTo(nextPos) * 0.28, 920))

  const approach = target.clone()
    .add(inbound.clone().multiplyScalar(-approachDistance))
    .add(side.clone().multiplyScalar(pass * 1.6))
    .add(up.clone().multiplyScalar(lift * 0.35))

  const periapsis = target.clone()
    .add(side.clone().multiplyScalar(pass))
    .add(up.clone().multiplyScalar(lift))

  const exit = target.clone()
    .add(outbound.clone().multiplyScalar(exitDistance))
    .add(side.clone().multiplyScalar(-pass * 1.5))
    .add(up.clone().multiplyScalar(lift * 0.75))

  return { leg, target, origin, nextPos, inbound, outbound, side, up, approach, periapsis, exit }
}

function exitPointForLeg(ctx, index) {
  return frameForLeg(ctx, index).exit
}

function positionOnLeg(ctx, frame, progress) {
  const p = clamp01(progress)
  if (p < 0.52) return lerpVector(ctx, frame.origin, frame.approach, p / 0.52)
  if (p < 0.68) return lerpVector(ctx, frame.approach, frame.periapsis, (p - 0.52) / 0.16)
  return lerpVector(ctx, frame.periapsis, frame.exit, (p - 0.68) / 0.32)
}

function lookOnLeg(ctx, frame, progress) {
  const depart = smoothstep((progress - 0.60) / 0.40)
  const outboundLook = frame.target.clone()
    .add(frame.outbound.clone().multiplyScalar(frame.leg.pass * 3.5))
    .add(frame.up.clone().multiplyScalar(frame.leg.lift * 0.25))
  return v3(ctx).lerpVectors(frame.target, outboundLook, depart)
}

function phaseForProgress(progress) {
  if (progress < 0.52) return 'approach'
  if (progress < 0.68) return 'periapsis burn'
  return 'departure'
}

function speedForLeg(index, progress) {
  const from = index > 0 ? FLYBY_PLAN[index - 1].speed : START_SPEED
  const to = FLYBY_PLAN[index].speed
  return lerpValue(from, to, smoothstep(progress))
}

function courseCorrectionFor(frame) {
  const dot = Math.min(1, Math.max(-1, frame.inbound.dot(frame.outbound)))
  return Math.acos(dot) * 180 / Math.PI
}

export function setupJourney(ctx) {
  ctx._journey = {
    time: 0,
    playing: false,
    done: false,
    legIndex: 0,
    currentTarget: FLYBY_PLAN[0].name,
    currentLabel: FLYBY_PLAN[0].label,
    nextTarget: FLYBY_PLAN[1].name,
    nextLabel: FLYBY_PLAN[1].label,
    phase: 'standby',
    speed: START_SPEED,
    courseCorrection: 0,
    deltaV: 0,
  }
}

export function startJourney(ctx) {
  if (!ctx._journey) setupJourney(ctx)
  ctx._journey.time = 0
  ctx._journey.playing = true
  ctx._journey.done = false
  ctx._journey.phase = 'solar departure'
  ctx._journey.speed = START_SPEED
}

export function updateJourney(ctx, dt) {
  const j = ctx._journey
  if (!j || !j.playing || j.done) return

  j.time = Math.min(TOTAL_DURATION, j.time + dt)

  const index = legIndexForTime(j.time)
  const leg = FLYBY_PLAN[index]
  const start = START_TIMES[index]
  const legProgress = leg.duration > 0 ? clamp01((j.time - start) / leg.duration) : 1
  const frame = frameForLeg(ctx, index)
  const pos = positionOnLeg(ctx, frame, legProgress)
  const look = lookOnLeg(ctx, frame, legProgress)

  ctx.camera.position.copy(pos)
  ctx.camera.lookAt(look.x, look.y, look.z)
  ctx.controls?.target?.copy?.(look)

  const next = FLYBY_PLAN[index + 1]
  const speed = speedForLeg(index, legProgress)
  const previousSpeed = index > 0 ? FLYBY_PLAN[index - 1].speed : START_SPEED

  j.legIndex = index
  j.currentTarget = leg.name
  j.currentLabel = leg.label
  j.nextTarget = next?.name ?? null
  j.nextLabel = next?.label ?? null
  j.phase = phaseForProgress(legProgress)
  j.speed = speed
  j.deltaV = Math.max(0, speed - previousSpeed)
  j.courseCorrection = courseCorrectionFor(frame)

  if (j.time >= TOTAL_DURATION) {
    j.done = true
    j.playing = false
    j.phase = 'interstellar coast'
  }
}

export function journeyProgress(ctx) {
  if (!ctx._journey) return 0
  return Math.min(1, ctx._journey.time / TOTAL_DURATION)
}

export function journeyDone(ctx) {
  return ctx._journey ? ctx._journey.done : false
}

export function currentPlanet(ctx) {
  if (!ctx._journey) return null
  return ctx._journey.currentTarget ?? null
}

export function journeyStatus(ctx) {
  if (!ctx._journey) return null
  const j = ctx._journey
  return {
    target: j.currentTarget,
    targetLabel: j.currentLabel,
    next: j.nextTarget,
    nextLabel: j.nextLabel,
    phase: j.phase,
    speed: j.speed,
    deltaV: j.deltaV,
    courseCorrection: j.courseCorrection,
    progress: journeyProgress(ctx),
    done: j.done,
    playing: j.playing,
  }
}

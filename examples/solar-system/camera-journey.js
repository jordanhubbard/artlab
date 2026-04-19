// Camera journey — a 55-second guided tour of the solar system.
//
// Distances match AU_SCALE = 100 (1 AU = 100 Three.js units).
// Each segment uses a smooth easeInOut lerp so arrivals feel weighted.
// Call startJourney(ctx) from a user gesture; then tick via updateJourney(ctx, dt).

const WAYPOINTS = [
  { t:  0, pos: [    0,  80,  200], look: [   0,  0,    0] },
  { t:  5, pos: [    0,  20,   50], look: [   0,  0,    0] },
  { t: 10, pos: [   42,   8,   12], look: [38.7, 0,    0] },
  { t: 16, pos: [   76,  10,   18], look: [72.3, 0,    0] },
  { t: 22, pos: [  105,   6,   14], look: [100,  0,    0] },
  { t: 27, pos: [  110,  20,   30], look: [100,  0,    0] },
  { t: 31, pos: [  158,   8,   20], look: [152.4, 0,   0] },
  { t: 36, pos: [  270,  15,   40], look: [270,  0,    0] },
  { t: 40, pos: [  545,  50,   80], look: [520.4, 0,   0] },
  { t: 44, pos: [  978,   4,   60], look: [953.7, 0,   0] },
  { t: 47, pos: [ 1940,  30,   90], look: [1919.1, 0,  0] },
  { t: 50, pos: [ 3030,  40,  100], look: [3006.9, 0,  0] },
  { t: 55, pos: [    0, 800, 2000], look: [   0,  0,    0] },
];

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function lerpV3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function setupJourney(ctx) {
  ctx._journey = { time: 0, playing: false, done: false };
}

export function startJourney(ctx) {
  if (!ctx._journey) setupJourney(ctx);
  ctx._journey.time    = 0;
  ctx._journey.playing = true;
  ctx._journey.done    = false;
}

export function updateJourney(ctx, dt) {
  const j = ctx._journey;
  if (!j || !j.playing || j.done) return;

  j.time += dt;
  const totalDuration = WAYPOINTS[WAYPOINTS.length - 1].t;
  if (j.time >= totalDuration) {
    j.time = totalDuration;
    j.done = true;
  }

  // Find surrounding waypoints
  let from = WAYPOINTS[0];
  let to   = WAYPOINTS[WAYPOINTS.length - 1];
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    if (j.time >= WAYPOINTS[i].t && j.time < WAYPOINTS[i + 1].t) {
      from = WAYPOINTS[i];
      to   = WAYPOINTS[i + 1];
      break;
    }
  }

  const segLen = to.t - from.t;
  const rawT   = segLen > 0 ? (j.time - from.t) / segLen : 1;
  const easedT = easeInOut(Math.min(1, Math.max(0, rawT)));

  const pos  = lerpV3(from.pos,  to.pos,  easedT);
  const look = lerpV3(from.look, to.look, easedT);

  ctx.camera.position.set(...pos);
  ctx.camera.lookAt(...look);
}

export function journeyProgress(ctx) {
  if (!ctx._journey) return 0;
  const totalDuration = WAYPOINTS[WAYPOINTS.length - 1].t;
  return Math.min(1, ctx._journey.time / totalDuration);
}

export function journeyDone(ctx) {
  return ctx._journey ? ctx._journey.done : false;
}

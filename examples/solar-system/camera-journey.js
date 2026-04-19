// Camera journey — an 8-minute cinematic grand tour of the solar system (AU_SCALE = 100).

const WAYPOINTS = [
  { t:   0, pos: [ 108,    3,   12], look: [ 100,   0,    0] },
  { t:  12, pos: [ 103,    6,   18], look: [ 100,   0,    2] },
  { t:  24, pos: [  92,   18,   40], look: [ 100,   2,    0] },
  { t:  40, pos: [  60,   30,   90], look: [  72,   0,    0] },
  { t:  55, pos: [  42,    8,   18], look: [38.7,   0,    2] },
  { t:  68, pos: [  36,   14,   22], look: [38.7,   1,    0] },
  { t:  80, pos: [  70,   12,   24], look: [72.3,   0,    2] },
  { t:  95, pos: [  78,   20,   35], look: [72.3,   2,    0] },
  { t: 112, pos: [ 104,    5,   14], look: [ 100,   0,    3] },
  { t: 130, pos: [ 107,   10,   28], look: [ 100,   1,    0] },
  { t: 148, pos: [ 100,   22,   55], look: [  96,   0,    0] },
  { t: 165, pos: [ 152,   35,   50], look: [152.4,  0,    4] },
  { t: 180, pos: [ 156,    6,   18], look: [152.4,  0,    2] },
  { t: 198, pos: [ 148,   20,   60], look: [  90,   5,    0] },
  { t: 215, pos: [ 240,   25,   70], look: [ 200,   4,    0] },
  { t: 232, pos: [ 350,   10,   55], look: [ 300,   0,    0] },
  { t: 250, pos: [ 530,   60,  110], look: [520.4,  0,    5] },
  { t: 275, pos: [ 492,   20,   60], look: [520.4,  8,    0] },
  { t: 295, pos: [ 505,   80,  200], look: [520.4,  0,    0] },
  { t: 320, pos: [ 960,  120,  200], look: [953.7,  0,    8] },
  { t: 348, pos: [ 953,  -12,   80], look: [953.7,  0,    4] },
  { t: 370, pos: [ 953,    2,  100], look: [953.7, 10,    0] },
  { t: 392, pos: [1925,   40,  120], look: [1919.1, 0,    6] },
  { t: 412, pos: [3020,   50,  130], look: [3006.9, 0,    8] },
  { t: 435, pos: [3006,   80,  300], look: [3006.9, 0,    0] },
  { t: 455, pos: [1600, 1200, 3200], look: [   0,   0,    0] },
  { t: 468, pos: [ 800, 2400, 5000], look: [   0,   0,    0] },
  { t: 480, pos: [ 200, 3000, 6500], look: [   0,   0,    0] },
];

const PLANET_RANGES = [
  { name: 'earth',   start:   0, end:  40 },
  { name: 'mercury', start:  40, end:  80 },
  { name: 'venus',   start:  80, end: 112 },
  { name: 'earth',   start: 112, end: 165 },
  { name: 'mars',    start: 165, end: 215 },
  { name: null,      start: 215, end: 250 },
  { name: 'jupiter', start: 250, end: 320 },
  { name: 'saturn',  start: 320, end: 392 },
  { name: 'uranus',  start: 392, end: 412 },
  { name: 'neptune', start: 412, end: 480 },
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

export function currentPlanet(ctx) {
  if (!ctx._journey) return null;
  const t = ctx._journey.time;
  for (const range of PLANET_RANGES) {
    if (t >= range.start && t < range.end) return range.name;
  }
  return null;
}

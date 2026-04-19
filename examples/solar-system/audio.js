// Audio setup — proximity pads, FFT bloom binding, background drone.
//
// This module wraps the Web Audio API directly. It must be initialised from
// a user-gesture handler (button click / keypress) because browsers block
// AudioContext creation otherwise.
//
// Exported surface:
//   setupAudio(ctx)      — call once from a user-gesture handler
//   updateAudio(ctx, dt) — call every frame from update()
//   teardownAudio(ctx)   — call when the tab goes hidden / package unloads

const BLOOM_BASE   = 0.55;
const BLOOM_RANGE  = 0.35;
const MAX_PAD_DIST = 300;
const MIN_PAD_DIST = 20;

// Tone frequencies for each planet (Hz, approximate note values)
const PLANET_TONES = {
  mercury: 987.77,   // B5
  venus:   392.00,   // G4
  earth:   261.63,   // C4
  mars:    174.61,   // F3
  jupiter: 110.00,   // A2
  saturn:   82.41,   // E2
  uranus:   73.42,   // D2
  neptune:  55.00,   // A1
};

function makePad(audioCtx, masterGain, freq, gainDb, reverbWet) {
  const gain = audioCtx.createGain();
  gain.gain.value = Math.pow(10, gainDb / 20);

  const osc = audioCtx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;

  // Simple reverb via convolver would need impulse response; use a delay
  // network as a lightweight substitute
  const delay  = audioCtx.createDelay(2.0);
  delay.delayTime.value = 0.4 * reverbWet;
  const fbGain = audioCtx.createGain();
  fbGain.gain.value = 0.4 * reverbWet;

  osc.connect(gain);
  gain.connect(delay);
  delay.connect(fbGain);
  fbGain.connect(delay);
  gain.connect(masterGain);
  delay.connect(masterGain);
  osc.start();

  return { osc, gain, baseGainDb: gainDb };
}

export function setupAudio(ctx) {
  try {
    const audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioCtx.destination);

    // Analyser for FFT bands
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    masterGain.connect(analyser);

    // Drone — very quiet continuous A1
    const droneGain = audioCtx.createGain();
    droneGain.gain.value = Math.pow(10, -28 / 20);
    const droneOsc  = audioCtx.createOscillator();
    droneOsc.type   = 'sine';
    droneOsc.frequency.value = 55;
    droneOsc.connect(droneGain);
    droneGain.connect(masterGain);
    droneOsc.start();

    // Per-planet pads
    const pads = {};
    for (const [name, freq] of Object.entries(PLANET_TONES)) {
      pads[name] = makePad(audioCtx, masterGain, freq, -18, 0.6);
    }

    ctx._audio = { audioCtx, masterGain, analyser, pads, fftData: new Uint8Array(analyser.frequencyBinCount) };
  } catch (e) {
    console.warn('Audio setup failed:', e);
  }
}

export function updateAudio(ctx, dt) {
  const a = ctx._audio;
  if (!a) return;

  // Pull FFT data
  a.analyser.getByteFrequencyData(a.fftData);
  const binCount  = a.fftData.length;
  const bassEnd   = Math.floor(binCount * 0.05);
  const midEnd    = Math.floor(binCount * 0.35);
  let bassSum = 0, midSum = 0, highSum = 0;
  for (let i = 0;        i < bassEnd;  i++) bassSum  += a.fftData[i];
  for (let i = bassEnd;  i < midEnd;   i++) midSum   += a.fftData[i];
  for (let i = midEnd;   i < binCount; i++) highSum  += a.fftData[i];
  const bassAmp = bassSum / (bassEnd * 255);
  const midAmp  = midSum  / ((midEnd - bassEnd) * 255);
  const highAmp = highSum / ((binCount - midEnd) * 255);

  // Drive bloom directly via ctx.setBloom() when available (StandaloneRunner),
  // or store in ctx._bloomStrength as a fallback for other runtimes.
  if (bassAmp > 0) {
    const strength = BLOOM_BASE + bassAmp * BLOOM_RANGE;
    ctx._bloomStrength = strength;
    if (ctx.setBloom) ctx.setBloom(strength);
  }

  // Sun emissive intensity reacts to mid
  if (ctx._sunMesh) {
    ctx._sunMesh.material.emissiveIntensity = 0.8 + midAmp * 0.6;
  }

  // Proximity-based pad volume
  if (!ctx._planets) return;
  const camPos = ctx.camera.position;
  for (const [name, pad] of Object.entries(a.pads)) {
    const planet = ctx._planets[name];
    if (!planet) continue;
    const dx   = camPos.x - planet.position.x;
    const dy   = camPos.y - planet.position.y;
    const dz   = camPos.z - planet.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const clamped = Math.min(MAX_PAD_DIST, Math.max(MIN_PAD_DIST, dist));
    const t = 1 - (clamped - MIN_PAD_DIST) / (MAX_PAD_DIST - MIN_PAD_DIST);
    const targetDb = -40 + (pad.baseGainDb - (-40)) * t;
    const targetGain = Math.pow(10, targetDb / 20);
    pad.gain.gain.setTargetAtTime(targetGain, a.audioCtx.currentTime, 0.5);
  }

  // Star opacity reacts to high freq
  if (ctx._stars) {
    ctx._stars.material.opacity = 0.6 + highAmp * 0.4;
  }
}

export function teardownAudio(ctx) {
  if (ctx._audio) {
    ctx._audio.audioCtx.suspend();
  }
}

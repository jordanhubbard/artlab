// audio-pulse — microphone-reactive central sphere + satellite ring, basic audio example.
import * as Three from 'three';

const SAT_COUNT  = 8;
const SAT_RADIUS = 8;
const SILENCE_FLOOR = 0.08;

function fftAvg(d, lo, hi) {
  let s = 0; for (let i = lo; i <= hi; i++) s += d[i];
  return s / ((hi - lo + 1) * 255);
}

function satColor(t) {
  return (Math.floor(30 + t * 225) << 16) | (Math.floor(20 + t * 60) << 8) | Math.floor(220 - t * 180);
}

function audioContextCtor() {
  return window.AudioContext || window.webkitAudioContext;
}

function setGain(gain, value, time = 0) {
  if (gain.gain?.setValueAtTime) gain.gain.setValueAtTime(value, time);
  else if (gain.gain) gain.gain.value = value;
}

function connectAnalyserToSilentSink(audioCtx, analyser) {
  const silentGain = audioCtx.createGain();
  setGain(silentGain, 0, audioCtx.currentTime ?? 0);
  analyser.connect(silentGain);
  silentGain.connect(audioCtx.destination);
  return silentGain;
}

async function startAudioGraph(ctx, btn) {
  const AudioContext = audioContextCtor();
  if (!AudioContext) throw new Error('Web Audio is not available in this browser');

  const audioCtx = new AudioContext();
  await audioCtx.resume?.();

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.78;
  const silentGain = connectAnalyserToSilentSink(audioCtx, analyser);

  let stream = null;
  let oscillator = null;
  let sourceType = 'microphone';

  try {
    stream = await navigator.mediaDevices?.getUserMedia?.({ audio: true, video: false });
    if (!stream) throw new Error('microphone unavailable');
    const mic = audioCtx.createMediaStreamSource(stream);
    mic.connect(analyser);
  } catch (_) {
    sourceType = 'fallback';
    oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 55;
    setGain(gain, 0.08, audioCtx.currentTime ?? 0);
    oscillator.connect(gain);
    gain.connect(analyser);
    oscillator.start();
  }

  ctx._audio = {
    audioCtx,
    analyser,
    silentGain,
    stream,
    oscillator,
    sourceType,
    fftData: new Uint8Array(analyser.frequencyBinCount),
    silenceFrames: 0,
  };
  btn.remove();
}

export function setup(ctx) {
  ctx.setHelp('Click to enable microphone input; if access is denied, a fallback pulse drives the visual.');
  ctx.camera.position.set(0, 0, 20);
  ctx.camera.lookAt(0, 0, 0);

  ctx.add(new Three.AmbientLight(0x111122, 0.5));
  const pt = new Three.PointLight(0xffffff, 2, 80, 2);
  pt.position.set(0, 10, 10);
  ctx.add(pt);

  const coreMat = new Three.MeshStandardMaterial({
    color: 0x1a0044, emissive: new Three.Color(0x3311aa),
    emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.3,
  });
  const core = new Three.Mesh(new Three.SphereGeometry(4, 48, 48), coreMat);
  ctx.add(core);
  ctx._core = core;

  ctx._sats = [];
  const satGeo = new Three.SphereGeometry(0.55, 20, 20);
  for (let i = 0; i < SAT_COUNT; i++) {
    const angle = (i / SAT_COUNT) * Math.PI * 2;
    const mat = new Three.MeshStandardMaterial({
      color: 0x2244ff, emissive: new Three.Color(0x112288), emissiveIntensity: 1.0,
      roughness: 0.3, metalness: 0.5,
    });
    const sat = new Three.Mesh(satGeo, mat);
    sat.position.set(Math.cos(angle) * SAT_RADIUS, 0, Math.sin(angle) * SAT_RADIUS);
    sat.userData.angle = angle;
    ctx.add(sat);
    ctx._sats.push(sat);
  }

  ctx._bassSpring = 0;
  ctx._audio = null;

  const container = ctx.renderer.domElement.parentElement;
  container.style.position = 'relative';
  let btn = container.querySelector('#start-btn');
  if (!btn) {
    btn = Object.assign(document.createElement('button'), { id: 'start-btn', textContent: 'Click to enable audio' });
    Object.assign(btn.style, {
      position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      padding: '12px 28px', fontSize: '15px', fontFamily: 'sans-serif',
      background: 'rgba(80,40,180,0.85)', color: '#fff', border: 'none',
      borderRadius: '8px', cursor: 'pointer', zIndex: 9999,
    });
    container.appendChild(btn);
  }
  ctx._btn = btn;
  btn.style.display = 'block';
  btn.disabled = false;
  btn.textContent = 'Click to enable audio';

  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'Starting audio...';
    try {
      await startAudioGraph(ctx, btn);
    } catch (err) {
      console.warn('[audio-pulse] audio start failed:', err);
      btn.disabled = false;
      btn.textContent = 'Retry audio';
    }
  };
}

export function update(ctx, dt) {
  const t = ctx.elapsed;
  let bass = 0, mid = 0;

  if (ctx._audio) {
    const { analyser, fftData } = ctx._audio;
    analyser.getByteFrequencyData(fftData);
    bass = fftAvg(fftData, 0, 12);
    mid  = fftAvg(fftData, 13, 90);
    const activeSignal = bass + mid > 0.012;
    ctx._audio.silenceFrames = activeSignal ? 0 : ctx._audio.silenceFrames + 1;
    const silentPulse = ctx._audio.silenceFrames > 12
      ? SILENCE_FLOOR + 0.06 * (0.5 + 0.5 * Math.sin(t * 4.5))
      : 0;
    bass = Math.max(bass, silentPulse);
    mid = Math.max(mid, silentPulse * 0.65);
    ctx.setBloom(0.6 + bass * 1.8);
    for (let i = 0; i < SAT_COUNT; i++) {
      const bin  = Math.floor(i * (128 / SAT_COUNT));
      const val  = Math.max(fftData[bin] / 255, silentPulse * (0.45 + 0.35 * Math.sin(t * 2 + i)));
      const sat  = ctx._sats[i];
      sat.position.set(Math.cos(sat.userData.angle) * SAT_RADIUS, val * 3.5, Math.sin(sat.userData.angle) * SAT_RADIUS);
      const hex = satColor(val);
      sat.material.color.setHex(hex);
      sat.material.emissive.setHex(hex);
      sat.material.emissiveIntensity = 0.5 + val * 1.2;
    }
  } else {
    bass = 0.08 + 0.06 * Math.sin(t * 1.3);
    mid  = 0.05 + 0.04 * Math.sin(t * 2.1);
    ctx.setBloom(0.6);
  }

  ctx._bassSpring += (bass - ctx._bassSpring) * (1 - Math.exp(-dt * 12));
  const s = 1.0 + ctx._bassSpring * 0.35;
  ctx._core.scale.set(s, s, s);
  ctx._core.material.emissiveIntensity = 0.9 + mid * 1.4;
}

export function teardown(ctx) {
  ctx._btn?.remove();
  if (ctx._audio) {
    try { ctx._audio.stream?.getTracks?.().forEach(track => track.stop()) } catch (_) {}
    try { ctx._audio.oscillator?.stop?.() } catch (_) {}
    try { ctx._audio.oscillator?.disconnect?.() } catch (_) {}
    try { ctx._audio.silentGain?.disconnect?.() } catch (_) {}
    try { ctx._audio.audioCtx.close() } catch (_) {}
    ctx._audio = null;
  }
}

// Tutorial 02 — Lighting: five modes cycle every 4 seconds, each documented live on-screen.
import * as THREE from 'three';

const CYCLE_DURATION = 4.0;

const MODES = [
  {
    name: 'Ambient Only',
    ctor: 'AmbientLight',
    params: 'color: 0x888888\nintensity: 1.0',
    desc: 'Uniform light from all directions.\nNo shadows, no directionality.',
  },
  {
    name: 'Directional + Ambient',
    ctor: 'DirectionalLight',
    params: 'color: 0xffffff\nintensity: 1.4\nposition: (5, 8, 4)',
    desc: 'Simulates distant sunlight.\nOne-sided shading, hard terminator.',
  },
  {
    name: 'Orbiting Point Light',
    ctor: 'PointLight',
    params: 'color: 0xff8844\nintensity: 2.0\ndistance: 12',
    desc: 'Emits in all directions from a point.\nDramatic falloff; great for flames.',
  },
  {
    name: 'Three-Point Studio',
    ctor: 'DirectionalLight \xd7 3',
    params: 'key: 0xfff0cc 1.4\nfill: 0x4488ff 0.5\nrim: 0xff4488 0.7',
    desc: 'Classic photography rig.\nKey + fill + rim separation.',
  },
  {
    name: 'Hemisphere',
    ctor: 'HemisphereLight',
    params: 'sky: 0x8888ff\nground: 0x664422\nintensity: 1.2',
    desc: 'Sky color from above, ground\ncolor from below. Soft, natural.',
  },
];

function makeOverlay() {
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed', 'top:16px', 'left:16px', 'z-index:99',
    'pointer-events:none', 'width:310px',
    'background:rgba(0,0,0,0.75)', 'color:#dde', 'font-family:monospace',
    'font-size:12px', 'line-height:1.65', 'padding:14px 16px',
    'border:1px solid rgba(100,140,255,0.3)', 'border-radius:4px',
    'transition:opacity 0.3s',
  ].join(';');
  document.body.appendChild(div);
  return div;
}

function updateOverlay(div, mode, idx, total) {
  div.innerHTML = [
    `<b style="color:#88aaff">TUTORIAL 02 \u2014 LIGHTING</b>`,
    `<span style="color:#556">${'\u2500'.repeat(27)}</span>`,
    `<b style="color:#ffcc66">Mode ${idx + 1}/${total}: ${mode.name}</b>`,
    '',
    `<span style="color:#88ff88">${mode.ctor}</span>`,
    `<span style="color:#aaa">${mode.params.replace(/\n/g, '\n')}</span>`,
    '',
    `<span style="color:#ccd">${mode.desc}</span>`,
    '',
    `<span style="color:#556">Next mode in ${CYCLE_DURATION}s\u2026</span>`,
  ].join('\n').replace(/\n/g, '<br>');
}

function clearLights(ctx) {
  for (const l of (ctx._lights || [])) {
    ctx.scene.remove(l);
    l.dispose && l.dispose();
  }
  ctx._lights = [];
}

function applyMode(ctx, idx) {
  const { THREE: T } = ctx;
  clearLights(ctx);
  const add = (l) => { ctx._lights.push(l); ctx.add(l); };

  if (idx === 0) {
    add(new THREE.AmbientLight(0x888888, 1.0));
  } else if (idx === 1) {
    add(new THREE.AmbientLight(0x111122, 0.4));
    const d = new THREE.DirectionalLight(0xffffff, 1.4);
    d.position.set(5, 8, 4);
    add(d);
  } else if (idx === 2) {
    add(new THREE.AmbientLight(0x111111, 0.2));
    const p = new THREE.PointLight(0xff8844, 2.0, 12);
    add(p);
    ctx._pointRef = p;
  } else if (idx === 3) {
    const key = new THREE.DirectionalLight(0xfff0cc, 1.4);
    key.position.set(5, 6, 3);
    add(key);
    const fill = new THREE.DirectionalLight(0x4488ff, 0.5);
    fill.position.set(-4, 2, 5);
    add(fill);
    const rim = new THREE.DirectionalLight(0xff4488, 0.7);
    rim.position.set(0, -2, -6);
    add(rim);
  } else {
    add(new THREE.HemisphereLight(0x8888ff, 0x664422, 1.2));
  }
}

export function setup(ctx) {
  ctx.camera.position.set(0, 1, 5);
  ctx.camera.lookAt(0, 0, 0);

  const geo = new THREE.SphereGeometry(1.2, 48, 24);
  const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0.1 });
  ctx._sphere = new THREE.Mesh(geo, mat);
  ctx.add(ctx._sphere);

  ctx._lights = [];
  ctx._modeIdx = -1;
  ctx._lastSwitch = -CYCLE_DURATION;

  ctx._overlay = makeOverlay();
  updateOverlay(ctx._overlay, MODES[0], 0, MODES.length);
  applyMode(ctx, 0);
  ctx._modeIdx = 0;
}

export function update(ctx, dt) {
  const t = ctx.elapsed;

  if (t - ctx._lastSwitch >= CYCLE_DURATION) {
    ctx._modeIdx = (ctx._modeIdx + 1) % MODES.length;
    applyMode(ctx, ctx._modeIdx);
    updateOverlay(ctx._overlay, MODES[ctx._modeIdx], ctx._modeIdx, MODES.length);
    ctx._lastSwitch = t;
  }

  if (ctx._modeIdx === 2 && ctx._pointRef) {
    ctx._pointRef.position.set(Math.cos(t * 1.2) * 3, 1.5, Math.sin(t * 1.2) * 3);
  }
}

export function teardown(ctx) {
  clearLights(ctx);
  ctx._overlay.remove();
}

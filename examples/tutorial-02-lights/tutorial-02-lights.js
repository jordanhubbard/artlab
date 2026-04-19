// Tutorial 02 — Lighting: five modes cycle every 4 seconds.
import * as THREE from 'three';

const CYCLE_DURATION = 4.0;

const MODES = [
  { name: 'Ambient Only' },
  { name: 'Directional + Ambient' },
  { name: 'Orbiting Point Light' },
  { name: 'Three-Point Studio' },
  { name: 'Hemisphere' },
];

function clearLights(ctx) {
  for (const l of (ctx._lights || [])) {
    ctx.scene.remove(l);
    l.dispose && l.dispose();
  }
  ctx._lights = [];
}

function applyMode(ctx, idx) {
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
  ctx._modeIdx = 0;
  ctx._lastSwitch = -CYCLE_DURATION;

  applyMode(ctx, 0);
}

export function update(ctx, dt) {
  const t = ctx.elapsed;

  if (t - ctx._lastSwitch >= CYCLE_DURATION) {
    ctx._modeIdx = (ctx._modeIdx + 1) % MODES.length;
    applyMode(ctx, ctx._modeIdx);
    ctx._lastSwitch = t;
  }

  if (ctx._modeIdx === 2 && ctx._pointRef) {
    ctx._pointRef.position.set(Math.cos(t * 1.2) * 3, 1.5, Math.sin(t * 1.2) * 3);
  }
}

export function teardown(ctx) {
  clearLights(ctx);
}

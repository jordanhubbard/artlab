// Tutorial 01 — Geometry & Materials: five primitives, slowly rotating, with an on-screen manual.
import * as THREE from 'three';

const SHAPES = [
  { label: 'sphere',   geo: () => new THREE.SphereGeometry(0.6, 32, 16),        color: 0x4466ff, pos: -4 },
  { label: 'box',      geo: () => new THREE.BoxGeometry(1.0, 1.0, 1.0),          color: 0xff6644, pos: -2 },
  { label: 'torus',    geo: () => new THREE.TorusGeometry(0.55, 0.22, 16, 48),   color: 0x44dd88, pos:  0 },
  { label: 'cylinder', geo: () => new THREE.CylinderGeometry(0.4, 0.4, 1.1, 32), color: 0xffcc22, pos:  2 },
  { label: 'cone',     geo: () => new THREE.ConeGeometry(0.5, 1.1, 32),          color: 0xcc44ff, pos:  4 },
];

function makeOverlay() {
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed', 'top:16px', 'left:16px', 'z-index:99',
    'pointer-events:none', 'width:320px',
    'background:rgba(0,0,0,0.72)', 'color:#cde', 'font-family:monospace',
    'font-size:12px', 'line-height:1.6', 'padding:14px 16px',
    'border:1px solid rgba(100,140,255,0.3)', 'border-radius:4px',
    'white-space:pre',
  ].join(';');
  div.textContent = [
    'TUTORIAL 01 \u2014 GEOMETRY',
    '\u2500'.repeat(23),
    'Artlab provides geometry factories',
    'for common 3D primitives.',
    '',
    '  sphere(r)      \u2192 SphereGeometry',
    '  box(w, h, d)   \u2192 BoxGeometry',
    '  torus(R, r)    \u2192 TorusGeometry',
    '  cylinder(r, h) \u2192 CylinderGeometry',
    '  cone(r, h)     \u2192 ConeGeometry',
    '',
    'Each wraps a THREE.BufferGeometry.',
    'Pass to mesh() with material options.',
    '',
    'mesh(geom, {',
    '  color: 0x4466ff,',
    '  roughness: 0.4,',
    '  emissive: 0x112244,',
    '})',
  ].join('\n');
  return div;
}

function makeLabelEl(text) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'z-index:98', 'pointer-events:none',
    'color:#aaccff', 'font-family:monospace', 'font-size:11px',
    'background:rgba(0,0,0,0.5)', 'padding:2px 6px', 'border-radius:3px',
  ].join(';');
  el.textContent = text;
  return el;
}

export function setup(ctx) {
  const { THREE: T, scene, camera, renderer } = ctx;

  camera.position.set(0, 2, 9);
  camera.lookAt(0, 0, 0);

  ctx.add(new THREE.AmbientLight(0x223355, 0.8));

  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(5, 8, 6);
  ctx.add(sun);

  const rim = new THREE.PointLight(0x4466ff, 1.2, 30);
  rim.position.set(-6, 4, -4);
  ctx.add(rim);

  ctx._meshes = [];
  ctx._labels = [];

  for (const def of SHAPES) {
    const geo = def.geo();
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: 0.35,
      metalness: 0.15,
      emissive: new THREE.Color(def.color).multiplyScalar(0.08),
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(def.pos, 0, 0);
    ctx.add(m);
    ctx._meshes.push(m);

    const lel = makeLabelEl(def.label);
    document.body.appendChild(lel);
    ctx._labels.push({ el: lel, mesh: m });
  }

  ctx._overlay = makeOverlay();
  document.body.appendChild(ctx._overlay);
  ctx._renderer = renderer;
}

export function update(ctx, dt) {
  const t = ctx.elapsed;

  for (let i = 0; i < ctx._meshes.length; i++) {
    const m = ctx._meshes[i];
    m.rotation.y += 0.4 * dt;
    m.rotation.x = Math.sin(t * 0.3 + i) * 0.25;
    m.position.y = Math.sin(t * 0.6 + i * 1.2) * 0.25;

    const labelInfo = ctx._labels[i];
    const canvas = ctx._renderer.domElement;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const pos = m.position.clone().project(ctx.camera);
    const sx = (pos.x * 0.5 + 0.5) * w;
    const sy = (-pos.y * 0.5 + 0.5) * h + 30;
    labelInfo.el.style.left = sx - 20 + 'px';
    labelInfo.el.style.top  = sy + 'px';
  }
}

export function teardown(ctx) {
  ctx._overlay.remove();
  for (const { el } of ctx._labels) el.remove();
}

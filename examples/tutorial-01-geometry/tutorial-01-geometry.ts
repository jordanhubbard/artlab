// Tutorial 01 — Geometry & Materials: five primitives, slowly rotating.
import * as Three from 'three';

const SHAPES = [
  { label: 'sphere',   geo: () => new Three.SphereGeometry(0.6, 32, 16),        color: 0x4466ff, pos: -4 },
  { label: 'box',      geo: () => new Three.BoxGeometry(1.0, 1.0, 1.0),          color: 0xff6644, pos: -2 },
  { label: 'torus',    geo: () => new Three.TorusGeometry(0.55, 0.22, 16, 48),   color: 0x44dd88, pos:  0 },
  { label: 'cylinder', geo: () => new Three.CylinderGeometry(0.4, 0.4, 1.1, 32), color: 0xffcc22, pos:  2 },
  { label: 'cone',     geo: () => new Three.ConeGeometry(0.5, 1.1, 32),          color: 0xcc44ff, pos:  4 },
];

function makeLabelEl(text) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:absolute', 'z-index:98', 'pointer-events:none',
    'color:#aaccff', 'font-family:monospace', 'font-size:11px',
    'background:rgba(0,0,0,0.5)', 'padding:2px 6px', 'border-radius:3px',
  ].join(';');
  el.textContent = text;
  return el;
}

export function setup(ctx) {
  const { Three: T, scene, camera, renderer } = ctx;

  camera.position.set(0, 2, 9);
  camera.lookAt(0, 0, 0);

  ctx.add(new Three.AmbientLight(0x223355, 0.8));

  const sun = new Three.DirectionalLight(0xffffff, 1.4);
  sun.position.set(5, 8, 6);
  ctx.add(sun);

  const rim = new Three.PointLight(0x4466ff, 1.2, 30);
  rim.position.set(-6, 4, -4);
  ctx.add(rim);

  const container = ctx.renderer.domElement.parentElement;
  ctx._meshes = [];
  ctx._labels = [];

  for (const def of SHAPES) {
    const geo = def.geo();
    const mat = new Three.MeshStandardMaterial({
      color: def.color,
      roughness: 0.35,
      metalness: 0.15,
      emissive: new Three.Color(def.color).multiplyScalar(0.08),
    });
    const m = new Three.Mesh(geo, mat);
    m.position.set(def.pos, 0, 0);
    ctx.add(m);
    ctx._meshes.push(m);

    const lel = makeLabelEl(def.label);
    container.appendChild(lel);
    ctx._labels.push({ el: lel, mesh: m });
  }

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
  for (const { el } of ctx._labels) el.remove();
}

// Tutorial 03 — Animation patterns: sine oscillation, linear sawtooth, and easeInOut, live.
import * as THREE from 'three';

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function makeLabelEl(text, color) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'z-index:98', 'pointer-events:none',
    `color:${color}`, 'font-family:monospace', 'font-size:11px',
    'background:rgba(0,0,0,0.55)', 'padding:2px 7px', 'border-radius:3px',
  ].join(';');
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

function placeLabel(el, mesh, camera, domEl) {
  const w = domEl.clientWidth, h = domEl.clientHeight;
  const p = mesh.position.clone().project(camera);
  el.style.left = ((p.x * 0.5 + 0.5) * w - 25) + 'px';
  el.style.top  = ((-p.y * 0.5 + 0.5) * h + 35) + 'px';
}

export function setup(ctx) {
  ctx.camera.position.set(0, 2.5, 9);
  ctx.camera.lookAt(0, 0, 0);

  ctx.add(new THREE.AmbientLight(0x223355, 0.8));
  const d = new THREE.DirectionalLight(0xffffff, 1.3);
  d.position.set(4, 8, 5);
  ctx.add(d);

  const defs = [
    { label: 'sin wave',  color: 0xff8877, x: -3, shape: 'sphere' },
    { label: 'linear',    color: 0x44ff88, x:  0, shape: 'box'    },
    { label: 'easeInOut', color: 0xffcc44, x:  3, shape: 'torus'  },
  ];

  ctx._objs = [];
  for (const d of defs) {
    let geo;
    if (d.shape === 'sphere') geo = new THREE.SphereGeometry(0.55, 32, 16);
    else if (d.shape === 'box') geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    else geo = new THREE.TorusGeometry(0.45, 0.18, 16, 40);
    const mat = new THREE.MeshStandardMaterial({
      color: d.color, roughness: 0.35, metalness: 0.15,
      emissive: new THREE.Color(d.color).multiplyScalar(0.1),
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(d.x, 0, 0);
    ctx.add(m);
    const lel = makeLabelEl(d.label, '#' + d.color.toString(16).padStart(6, '0'));
    ctx._objs.push({ mesh: m, lel, x: d.x });
  }
}

export function update(ctx, dt) {
  const t = ctx.elapsed;

  const sv = Math.sin(t);
  const lv = (t % 1) * 2 - 1;
  const et = (t % 2) / 2;
  const ev = easeInOut(et) * 2 - 1;

  ctx._objs[0].mesh.position.y = sv * 1.4;
  ctx._objs[1].mesh.position.y = lv * 1.4;
  ctx._objs[2].mesh.position.y = ev * 1.4;
  ctx._objs[0].mesh.rotation.y += 0.5 * dt;
  ctx._objs[1].mesh.rotation.y += 0.5 * dt;
  ctx._objs[2].mesh.rotation.y += 0.5 * dt;

  for (const { mesh, lel } of ctx._objs)
    placeLabel(lel, mesh, ctx.camera, ctx.renderer.domElement);
}

export function teardown(ctx) {
  for (const { lel } of ctx._objs) lel.remove();
}

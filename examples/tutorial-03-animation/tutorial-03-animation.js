// Tutorial 03 — Animation patterns: sine oscillation, linear sawtooth, and easeInOut, live.
import * as THREE from 'three';

const GRAPH_W = 220, GRAPH_H = 70, HISTORY = 220;

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function makeOverlay() {
  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'position:fixed', 'top:16px', 'left:16px', 'z-index:99',
    'pointer-events:none', 'width:320px',
    'background:rgba(0,0,0,0.75)', 'color:#cde', 'font-family:monospace',
    'font-size:12px', 'line-height:1.6', 'padding:14px 16px',
    'border:1px solid rgba(100,140,255,0.3)', 'border-radius:4px',
  ].join(';');

  wrap.innerHTML = [
    `<b style="color:#88aaff">TUTORIAL 03 \u2014 ANIMATION</b><br>`,
    `<span style="color:#445">${'\u2500'.repeat(27)}</span><br>`,
    `<span style="color:#ff8877">&#9632;</span> <b>sin(elapsed)</b> &mdash; smooth oscillation<br>`,
    `<span style="color:#aaa">  y = Math.sin(elapsed) * amp</span><br><br>`,
    `<span style="color:#88ff88">&#9632;</span> <b>elapsed % 1</b> &mdash; sawtooth / linear<br>`,
    `<span style="color:#aaa">  y = (elapsed % 1) * 2 - 1</span><br><br>`,
    `<span style="color:#ffcc44">&#9632;</span> <b>easeInOut</b> &mdash; smooth start &amp; end<br>`,
    `<span style="color:#aaa">  t = (elapsed%2)/2<br>  y = easeInOut(t)*2-1</span><br><br>`,
    `<span style="color:#556">Live graph \u2193</span><br>`,
  ].join('');

  const canvas = document.createElement('canvas');
  canvas.width = GRAPH_W;
  canvas.height = GRAPH_H;
  canvas.style.cssText = 'display:block;margin-top:6px;border:1px solid #334;border-radius:2px;';
  wrap.appendChild(canvas);
  document.body.appendChild(wrap);
  return { wrap, canvas, ctx2d: canvas.getContext('2d') };
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
    ctx._objs.push({ mesh: m, lel, x: d.x, label: d.label });
  }

  ctx._ov = makeOverlay();
  ctx._hist = { sin: [], lin: [], ease: [] };
}

export function update(ctx, dt) {
  const t = ctx.elapsed;

  const sv  = Math.sin(t);
  const lv  = (t % 1) * 2 - 1;
  const et  = (t % 2) / 2;
  const ev  = easeInOut(et) * 2 - 1;

  ctx._objs[0].mesh.position.y = sv * 1.4;
  ctx._objs[1].mesh.position.y = lv * 1.4;
  ctx._objs[2].mesh.position.y = ev * 1.4;
  ctx._objs[0].mesh.rotation.y += 0.5 * dt;
  ctx._objs[1].mesh.rotation.y += 0.5 * dt;
  ctx._objs[2].mesh.rotation.y += 0.5 * dt;

  for (const { mesh, lel } of ctx._objs)
    placeLabel(lel, mesh, ctx.camera, ctx.renderer.domElement);

  const h = ctx._hist;
  h.sin.push(sv);  if (h.sin.length  > HISTORY) h.sin.shift();
  h.lin.push(lv);  if (h.lin.length  > HISTORY) h.lin.shift();
  h.ease.push(ev); if (h.ease.length > HISTORY) h.ease.shift();

  const c = ctx._ov.ctx2d;
  c.clearRect(0, 0, GRAPH_W, GRAPH_H);
  c.fillStyle = '#0a0c14';
  c.fillRect(0, 0, GRAPH_W, GRAPH_H);

  const drawCurve = (data, color) => {
    c.beginPath();
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    for (let i = 0; i < data.length; i++) {
      const x = (i / HISTORY) * GRAPH_W;
      const y = GRAPH_H / 2 - (data[i] / 2) * (GRAPH_H / 2 - 4);
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
  };

  c.strokeStyle = '#223'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, GRAPH_H / 2); c.lineTo(GRAPH_W, GRAPH_H / 2); c.stroke();

  drawCurve(h.sin,  '#ff8877');
  drawCurve(h.lin,  '#44ff88');
  drawCurve(h.ease, '#ffcc44');
}

export function teardown(ctx) {
  ctx._ov.wrap.remove();
  for (const { lel } of ctx._objs) lel.remove();
}

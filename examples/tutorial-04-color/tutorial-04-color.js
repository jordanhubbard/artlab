// Tutorial 04 — Color & Material: a 4x4 grid of spheres showing HSL and PBR parameters.
import * as THREE from 'three';

const COLS = 4, ROWS = 4, SPACING = 2.2;

const ROW_DEFS = [
  { label: 'Hue rotation',     prop: 'color (H in HSL)',          detail: 'H: 0\u2192360, S=0.7, L=0.55' },
  { label: 'Saturation ramp',  prop: 'color (S in HSL)',          detail: 'H=220, S: 0\u21921, L=0.55'   },
  { label: 'Emissive ramp',    prop: 'material.emissive',         detail: 'emissiveIntensity: 0\u21921'   },
  { label: 'Metalness/Rough',  prop: 'metalness + roughness',     detail: 'PBR: 4 combos'                 },
];

const PBR_COMBOS = [
  { metalness: 0.0, roughness: 0.9, label: 'rough/matte'   },
  { metalness: 1.0, roughness: 0.9, label: 'rough/metal'   },
  { metalness: 0.0, roughness: 0.05, label: 'smooth/matte' },
  { metalness: 1.0, roughness: 0.05, label: 'smooth/metal' },
];

function rowColor(row, col) {
  const c = new THREE.Color();
  const t = col / (COLS - 1);
  if (row === 0) c.setHSL(t, 0.7, 0.55);
  else if (row === 1) c.setHSL(220 / 360, t, 0.55);
  else if (row === 2) c.setHSL(220 / 360, 0.7, 0.55);
  else c.set(0xaaaaaa);
  return c;
}

function makeOverlay() {
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed', 'top:16px', 'left:16px', 'z-index:99',
    'pointer-events:none', 'width:310px',
    'background:rgba(0,0,0,0.76)', 'color:#cde', 'font-family:monospace',
    'font-size:12px', 'line-height:1.65', 'padding:14px 16px',
    'border:1px solid rgba(100,140,255,0.3)', 'border-radius:4px',
  ].join(';');

  let html = `<b style="color:#88aaff">TUTORIAL 04 \u2014 COLOR &amp; MATERIAL</b><br>`;
  html += `<span style="color:#334">${'\u2500'.repeat(27)}</span><br><br>`;
  for (let r = 0; r < ROW_DEFS.length; r++) {
    const d = ROW_DEFS[r];
    html += `<b style="color:#ffcc66">Row ${r + 1}: ${d.label}</b><br>`;
    html += `<span style="color:#88ff88">  ${d.prop}</span><br>`;
    html += `<span style="color:#aaa">  ${d.detail}</span><br><br>`;
  }
  html += `<span style="color:#aaa">THREE.Color.setHSL(h, s, l)<br>MeshStandardMaterial {<br>  metalness, roughness,<br>  emissive, emissiveIntensity<br>}</span>`;
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

export function setup(ctx) {
  const { THREE: T } = ctx;

  ctx.camera.position.set(0, 4.5, 14);
  ctx.camera.lookAt(0, 0, 0);

  ctx.add(new THREE.AmbientLight(0x334466, 0.7));
  const d1 = new THREE.DirectionalLight(0xffffff, 1.2);
  d1.position.set(6, 10, 8);
  ctx.add(d1);
  const d2 = new THREE.DirectionalLight(0x4466ff, 0.4);
  d2.position.set(-8, 4, -4);
  ctx.add(d2);

  const geo = new THREE.SphereGeometry(0.7, 32, 16);
  ctx._spheres = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const col = rowColor(r, c);
      const t = c / (COLS - 1);

      const matOpts = { color: col, roughness: 0.4, metalness: 0.1 };

      if (r === 2) {
        matOpts.emissive = col.clone();
        matOpts.emissiveIntensity = t;
      } else if (r === 3) {
        const pbr = PBR_COMBOS[c];
        matOpts.roughness = pbr.roughness;
        matOpts.metalness = pbr.metalness;
      }

      const mat = new THREE.MeshStandardMaterial(matOpts);
      const mesh = new THREE.Mesh(geo, mat);
      const x = (c - (COLS - 1) / 2) * SPACING;
      const y = ((ROWS - 1) / 2 - r) * SPACING;
      mesh.position.set(x, y, 0);
      mesh.userData.row = r;
      mesh.userData.col = c;
      ctx.add(mesh);
      ctx._spheres.push(mesh);
    }
  }

  ctx._overlay = makeOverlay();
}

export function update(ctx, dt) {
  const t = ctx.elapsed;
  for (const m of ctx._spheres) {
    const r = m.userData.row;
    const c = m.userData.col;
    const phase = r * 0.7 + c * 0.4;

    if (r === 0) {
      const h = ((t * 0.08 + c / COLS) % 1);
      m.material.color.setHSL(h, 0.7, 0.55);
    }

    m.rotation.y += 0.25 * dt;
    m.position.z = Math.sin(t * 0.5 + phase) * 0.15;
  }
}

export function teardown(ctx) {
  ctx._overlay.remove();
}

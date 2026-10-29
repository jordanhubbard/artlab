// Tutorial 04 — Color & Material: a 4x4 grid of spheres showing HSL and PBR parameters.
import * as Three from 'three';

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
  const c = new Three.Color();
  const t = col / (COLS - 1);
  if (row === 0) c.setHSL(t, 0.7, 0.55);
  else if (row === 1) c.setHSL(220 / 360, t, 0.55);
  else if (row === 2) c.setHSL(220 / 360, 0.7, 0.55);
  else c.set(0xaaaaaa);
  return c;
}

export function setup(ctx) {
  const { Three: T } = ctx;

  ctx.camera.position.set(0, 4.5, 14);
  ctx.camera.lookAt(0, 0, 0);

  ctx.add(new Three.AmbientLight(0x334466, 0.7));
  const d1 = new Three.DirectionalLight(0xffffff, 1.2);
  d1.position.set(6, 10, 8);
  ctx.add(d1);
  const d2 = new Three.DirectionalLight(0x4466ff, 0.4);
  d2.position.set(-8, 4, -4);
  ctx.add(d2);

  const geo = new Three.SphereGeometry(0.7, 32, 16);
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

      const mat = new Three.MeshStandardMaterial(matOpts);
      const mesh = new Three.Mesh(geo, mat);
      const x = (c - (COLS - 1) / 2) * SPACING;
      const y = ((ROWS - 1) / 2 - r) * SPACING;
      mesh.position.set(x, y, 0);
      mesh.userData.row = r;
      mesh.userData.col = c;
      ctx.add(mesh);
      ctx._spheres.push(mesh);
    }
  }

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

export function teardown(_ctx) {}

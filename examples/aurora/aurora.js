// Aurora Borealis — you are standing in a dark field looking up.
// A dome of stars fills the sky. In the upper hemisphere, thin vertical
// curtains of color undulate with slow sine waves — greens fading into teals
// and violets, like the northern lights.

const STAR_COUNT    = 280;
const CURTAIN_COUNT = 9;
const CURTAIN_SEGS  = 12;
const CURTAIN_HEIGHT = 8.0;
const CURTAIN_WIDTH  = 3.5;
const ARC_RADIUS     = 16.0;

function curtainColor(ci) {
  const t = ci % 3;
  if (t < 1) return 0x00ff88;
  if (t < 2) return 0x00ddcc;
  return 0x9933ff;
}

function curtainEmissive(ci) {
  const t = ci % 3;
  if (t < 1) return 0x004422;
  if (t < 2) return 0x003333;
  return 0x220044;
}

function starColor(i) {
  const t = Math.abs(Math.sin(i * 127.3 + 31.7)) % 1.0;
  if (t < 0.25) return 0xaaccff;
  if (t < 0.50) return 0xffffff;
  if (t < 0.75) return 0xffeedd;
  return 0xddeeff;
}

function rand(seed) {
  return Math.abs(Math.sin(seed * 127.1 + 311.7) * Math.cos(seed * 269.5 + 183.3));
}

export function setup(ctx) {
  const { THREE, sphere, plane, mesh, ambient, point } = ctx;

  ctx.camera.position.set(0, 1.5, 0);
  ctx.controls.target.set(0, 6, -16);
  ctx.controls.update();

  ctx.add(ambient(0x020408, 1.0));

  const pLight1 = point(0x00ff88, 2.5, 40, 2);
  const pLight2 = point(0x8800ff, 2.0, 40, 2);
  const pLight3 = point(0x00ccaa, 1.5, 40, 2);
  pLight1.position.set(0, 4, -10);
  pLight2.position.set(-8, 4, -6);
  pLight3.position.set(8, 4, -6);
  ctx.add(pLight1);
  ctx.add(pLight2);
  ctx.add(pLight3);

  // Ground plane
  const groundMesh = mesh(plane(80, 80), { color: 0x050808, roughness: 1.0, metalness: 0.0 });
  groundMesh.material.emissive = new THREE.Color(0x020404);
  groundMesh.rotation.x = -Math.PI / 2;
  ctx.add(groundMesh);

  // Stars
  ctx._stars = [];
  const starGeo = sphere(0.04, 4);
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta   = rand(i * 3.1) * Math.PI;
    const phi     = rand(i * 7.7) * Math.PI * 2;
    const dome_r  = 60 + rand(i * 13.1) * 20;
    const sy = Math.abs(Math.cos(theta)) * dome_r * 0.9 + 2.0;
    const sx = Math.sin(theta) * Math.cos(phi) * dome_r;
    const sz = Math.sin(theta) * Math.sin(phi) * dome_r - 20;

    const col = starColor(i);
    const mat = new THREE.MeshStandardMaterial({
      color: col, emissive: col, roughness: 1.0, metalness: 0.0
    });
    const star = new THREE.Mesh(starGeo, mat);
    const ss = 0.3 + rand(i * 5.5) * 1.4;
    star.scale.set(ss, ss, ss);
    star.position.set(sx, sy, sz);
    ctx.add(star);
    ctx._stars.push(star);
  }

  // Aurora curtain panels
  ctx._panels = [];
  const segH = CURTAIN_HEIGHT / CURTAIN_SEGS;
  for (let ci = 0; ci < CURTAIN_COUNT; ci++) {
    const arcAngle = (ci / (CURTAIN_COUNT - 1) - 0.5) * 2.2;
    const cx = ARC_RADIUS * Math.sin(arcAngle);
    const cz = -ARC_RADIUS * Math.cos(arcAngle) - 4.0;
    const tilt = arcAngle * 0.25;
    const emissiveBase = curtainEmissive(ci);

    for (let seg = 0; seg < CURTAIN_SEGS; seg++) {
      const base_y = 2.0 + seg * segH + segH * 0.5;
      const panelGeo = plane(CURTAIN_WIDTH, segH);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: new THREE.Color(emissiveBase),
        roughness: 1.0, metalness: 0.0
      });
      const panel = new THREE.Mesh(panelGeo, mat);
      panel.position.set(cx, base_y, cz);
      panel.rotation.y = arcAngle + Math.PI / 2;
      panel.rotation.z = tilt;
      panel.userData.ci        = ci;
      panel.userData.seg       = seg;
      panel.userData.base_x    = cx;
      panel.userData.base_y    = base_y;
      panel.userData.base_z    = cz;
      panel.userData.arcAngle  = arcAngle;
      panel.userData.emBase    = emissiveBase;
      ctx.add(panel);
      ctx._panels.push(panel);
    }
  }
}

export function update(ctx, dt) {
  const t = ctx.elapsed;

  // Animate curtain panels
  for (const panel of ctx._panels) {
    const { ci, seg, base_x, base_y, base_z, arcAngle, emBase } = panel.userData;
    const wave1 = Math.sin(t * 0.4 + ci * 0.8 + seg * 0.5) * 0.7;
    const wave2 = Math.sin(t * 0.7 - ci * 0.5 + seg * 0.9) * 0.4;
    const wave3 = Math.cos(t * 0.25 + ci * 1.2 - seg * 0.3) * 0.3;
    const perp = arcAngle + Math.PI / 2;
    const sway_x = (wave1 + wave2) * Math.sin(perp);
    const sway_z = (wave1 + wave2) * Math.cos(perp);
    const sway_y = wave3 * (seg / CURTAIN_SEGS);
    panel.position.set(base_x + sway_x, base_y + sway_y, base_z + sway_z);

    const hf = seg / CURTAIN_SEGS;
    const brightness = 0.4 + 0.6 * hf;
    const pulse = brightness * (0.7 + 0.3 * Math.sin(t * 1.1 + ci * 0.6 + seg * 0.4));

    const er = Math.min(255, Math.floor(((emBase >> 16) & 0xff) * pulse * 2.5));
    const eg = Math.min(255, Math.floor(((emBase >>  8) & 0xff) * pulse * 2.5));
    const eb = Math.min(255, Math.floor(( emBase        & 0xff) * pulse * 2.5));
    panel.material.emissive.setHex((er << 16) | (eg << 8) | eb);
  }

  // Twinkle stars
  for (let si = 0; si < ctx._stars.length; si++) {
    const star = ctx._stars[si];
    const twinkle = 0.7 + 0.3 * Math.sin(t * (1.5 + si * 0.01) + si * 3.7);
    const base = starColor(si);
    const sr = Math.floor(((base >> 16) & 0xff) * twinkle);
    const sg = Math.floor(((base >>  8) & 0xff) * twinkle);
    const sb = Math.floor(( base        & 0xff) * twinkle);
    star.material.emissive.setHex((sr << 16) | (sg << 8) | sb);
  }
}

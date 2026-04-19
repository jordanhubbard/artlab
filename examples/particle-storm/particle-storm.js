// Particle Storm — 500 tiny spheres erupt from the origin like a firework
// or solar storm. Each particle travels along a random direction, spiraling
// slightly, and resets when it escapes the scene radius. Colors transition
// from hot white at the core through orange and deep red at the fringe.

const NUM        = 500;
const RESET_DIST = 8.0;
const SPHERE_R   = 0.06;

function randVel(seed) {
  return Math.sin(seed * 127.1 + 311.7) * Math.cos(seed * 269.5 + 183.3);
}

function fireColor(dist) {
  const t = Math.min(1, Math.max(0, dist / RESET_DIST));
  let r, g, b;
  if (t < 0.3) {
    const s = t / 0.3;
    r = 1.0; g = 1.0 - s * 0.07; b = 1.0 - s;
  } else if (t < 0.6) {
    const s = (t - 0.3) / 0.3;
    r = 1.0; g = 0.93 - s * 0.53; b = 0.0;
  } else {
    const s = (t - 0.6) / 0.4;
    r = 1.0 - s * 0.47; g = 0.4 - s * 0.4; b = 0.0;
  }
  const ri = Math.floor(Math.min(1, r) * 255);
  const gi = Math.floor(Math.min(1, Math.max(0, g)) * 255);
  const bi = Math.floor(Math.min(1, b) * 255);
  return (ri << 16) | (gi << 8) | bi;
}

function spawn(p, seed) {
  let vx = randVel(seed);
  let vy = randVel(seed + 1);
  let vz = randVel(seed + 2);
  let len = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (len < 0.001) len = 1.0;
  const speed = 1.5 + Math.abs(randVel(seed + 3)) * 3.0;
  const inv = speed / len;
  p.userData.vx   = vx * inv;
  p.userData.vy   = vy * inv;
  p.userData.vz   = vz * inv;
  p.userData.seed = seed;
  p.position.set(
    randVel(seed + 4) * 0.3,
    randVel(seed + 5) * 0.3,
    randVel(seed + 6) * 0.3
  );
}

export function setup(ctx) {
  const { Three, sphere, mesh, ambient, point } = ctx;

  ctx.camera.position.set(0, 2, 14);

  ctx.add(ambient(0x050508, 1.0));
  const ptLight = point(0xff4400, 3.0, 0, 2);
  ptLight.position.set(0, 0, 0);
  ctx.add(ptLight);

  const geo = sphere(SPHERE_R, 4);
  ctx._particles = [];

  for (let i = 0; i < NUM; i++) {
    const mat = new Three.MeshStandardMaterial({
      color: 0xffffff, emissive: new Three.Color(0xffffff),
      roughness: 1.0, metalness: 0.0
    });
    const p = new Three.Mesh(geo, mat);
    spawn(p, i * 7.0 + 1.0);
    ctx.add(p);
    ctx._particles.push(p);
  }
}

export function update(ctx, dt) {
  const elapsed = ctx.elapsed;

  for (const p of ctx._particles) {
    // Spiral: rotate velocity slightly in XZ plane
    const vx   = p.userData.vx;
    const vz   = p.userData.vz;
    const spin = 0.6 * dt;
    p.userData.vx = vx * Math.cos(spin) - vz * Math.sin(spin);
    p.userData.vz = vx * Math.sin(spin) + vz * Math.cos(spin);

    p.position.x += p.userData.vx * dt;
    p.position.y += p.userData.vy * dt;
    p.position.z += p.userData.vz * dt;

    const dx = p.position.x;
    const dy = p.position.y;
    const dz = p.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist >= RESET_DIST) {
      spawn(p, p.userData.seed + elapsed * 13.0);
    }

    const hex = fireColor(dist);
    p.material.color.setHex(hex);
    p.material.emissive.setHex(hex);

    const s = 1.0 - Math.min(0.85, dist / RESET_DIST);
    p.scale.set(s, s, s);
  }
}

export function teardown(ctx) {}

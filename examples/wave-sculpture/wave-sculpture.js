// Wave Sculpture — 15x15 spheres ripple as a continuous sine wave landscape.
// Y-position encodes wave height; color blends from deep navy (troughs) to
// bright cyan (peaks) for a liquid-light aesthetic.

const GRID_N    = 15;
const SPACING   = 1.4;
const HALF_N    = 7.0;
const SPHERE_R  = 0.15;
const WAVE_AMP  = 1.2;

function colorFromY(y) {
  const t = Math.min(1, Math.max(0, (y + WAVE_AMP) / (2 * WAVE_AMP)));
  const r = Math.floor(10  * (1 - t));
  const g = Math.floor(26  + (245 - 26)  * t);
  const b = Math.floor(110 + (255 - 110) * t);
  return (r << 16) | (g << 8) | b;
}

export function setup(ctx) {
  const { THREE, sphere, mesh, directional, point, ambient } = ctx;

  ctx.camera.position.set(0, 8, 20);
  ctx.camera.lookAt(0, 0, 0);

  const dirLight = directional(0xffffff, 1.2);
  dirLight.position.set(0, 10, 5);
  ctx.add(dirLight);

  const ptLight = point(0xff9955, 1.0, 80, 2);
  ptLight.position.set(0, 4, 0);
  ctx.add(ptLight);

  ctx.add(ambient(0x112244, 0.5));

  ctx._balls = [];
  const geo = sphere(SPHERE_R, 10);

  for (let row = 0; row < GRID_N; row++) {
    for (let col = 0; col < GRID_N; col++) {
      const xpos = (col - HALF_N) * SPACING;
      const zpos = (row - HALF_N) * SPACING;
      const ball = mesh(geo, { color: 0x00aaff, roughness: 0.3, metalness: 0.6 });
      ball.material.emissive = new THREE.Color(0x001133);
      ball.position.set(xpos, 0, zpos);
      ball.userData.col = col;
      ball.userData.row = row;
      ctx.add(ball);
      ctx._balls.push(ball);
    }
  }
}

export function update(ctx, dt) {
  const elapsed = ctx.elapsed;

  for (const ball of ctx._balls) {
    const xg = ball.userData.col - HALF_N;
    const zg = ball.userData.row - HALF_N;

    let y = Math.sin(elapsed * 1.5 + xg * 0.5 + zg * 0.4) * WAVE_AMP;
    y    += Math.sin(elapsed * 0.9 - xg * 0.3 + zg * 0.6) * 0.35;

    ball.position.y = y;

    const hex = colorFromY(y);
    ball.material.color.setHex(hex);
    ball.material.emissive.setHex(Math.floor(hex * 0.15));

    const t = Math.min(1, Math.max(0, (y + WAVE_AMP) / (2 * WAVE_AMP)));
    const s = 0.8 + 0.6 * t;
    ball.scale.set(s, s, s);
  }
}

export function teardown(ctx) {}

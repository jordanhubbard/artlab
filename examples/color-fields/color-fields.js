// Color Fields — a flowing 20x20 grid of emissive color planes.
// Each cell pulses through a unique hue derived from its grid position
// and the global elapsed time, creating a slow chromatic wave.

const GRID_SIZE    = 20;
const CELL_SPACING = 1.05;
const HALF         = 9.5; // (GRID_SIZE - 1) / 2

// HSL to RGB conversion
function hslToRgb(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  function hue(t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }
  return [hue(h + 1/3), hue(h), hue(h - 1/3)];
}

function hslToHex(h, s, l) {
  const [r, g, b] = hslToRgb(h, s, l);
  const ri = Math.floor(Math.min(1, Math.max(0, r)) * 255);
  const gi = Math.floor(Math.min(1, Math.max(0, g)) * 255);
  const bi = Math.floor(Math.min(1, Math.max(0, b)) * 255);
  return (ri << 16) | (gi << 8) | bi;
}

export function setup(ctx) {
  const { plane, mesh, ambient } = ctx;

  ctx.camera.position.set(0, 0, 28);
  ctx.add(ambient(0x111111, 0.4));

  ctx._tiles = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const nx = col - HALF;
      const ny = row - HALF;
      let h = ((nx * 0.05 + ny * 0.04 + 0.5) % 1.0 + 1.0) % 1.0;
      const hex = hslToHex(h, 1.0, 0.5);

      const tile = mesh(plane(1.0, 1.0), { color: 0x000000, roughness: 1.0, metalness: 0.0 });
      tile.material.emissive.setHex(hex);
      tile.position.set(nx * CELL_SPACING, ny * CELL_SPACING, 0);
      tile.userData.col = col;
      tile.userData.row = row;
      ctx.add(tile);
      ctx._tiles.push(tile);
    }
  }
}

export function update(ctx, dt) {
  const elapsed = ctx.elapsed;

  for (const tile of ctx._tiles) {
    const col = tile.userData.col;
    const row = tile.userData.row;
    const nx = col - HALF;
    const ny = row - HALF;

    const wave  = Math.sin(elapsed * 0.4 + nx * 0.3 + ny * 0.2);
    let base_h  = ((nx * 0.05 + ny * 0.04 + elapsed * 0.06) % 1.0 + 1.0) % 1.0;
    let h       = ((base_h + wave * 0.15) % 1.0 + 1.0) % 1.0;
    const l     = 0.42 + 0.18 * Math.sin(elapsed * 0.7 + nx * 0.25 - ny * 0.18);

    tile.material.emissive.setHex(hslToHex(h, 1.0, l));
  }
}

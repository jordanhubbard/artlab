import * as Three from 'three'
import { InstanceField } from '../../src/stdlib/scene/InstanceField.js'

function randVel(seed) {
  return Math.sin(seed * 127.1 + 311.7) * Math.cos(seed * 269.5 + 183.3);
}

function fireColor(dist, radius) {
  const t = Math.min(1, Math.max(0, dist / radius));
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
  p.vx   = vx * inv;
  p.vy   = vy * inv;
  p.vz   = vz * inv;
  p.seed = seed;
  p.position.set(
    randVel(seed + 4) * 0.3,
    randVel(seed + 5) * 0.3,
    randVel(seed + 6) * 0.3
  );
}


export class EmberField extends InstanceField {
  constructor({ count = 500, radius = 8 } = {}) {
    super(count, new Three.SphereGeometry(0.06, 4, 4), new Three.MeshBasicMaterial({ color: 0xffffff }))
    this.radius = radius
    this.particles = Array.from({ length: count }, (_, i) => {
      const particle = { position: new Three.Vector3() }
      spawn(particle, i * 7 + 1)
      return particle
    })
    this.update(0, 0)
  }

  update(dt, elapsed) {
    const spin = 0.6 * dt
    const cos = Math.cos(spin), sin = Math.sin(spin)
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i]
      const vx = p.vx, vz = p.vz
      p.vx = vx * cos - vz * sin
      p.vz = vx * sin + vz * cos
      p.position.x += p.vx * dt
      p.position.y += p.vy * dt
      p.position.z += p.vz * dt
      let distance = p.position.length()
      if (distance >= this.radius) {
        spawn(p, p.seed + elapsed * 13)
        distance = p.position.length()
      }
      this.set(i, p.position, 1 - Math.min(0.85, distance / this.radius), fireColor(distance, this.radius))
    }
    this.commit()
  }
}

import * as Three from 'three'
import { ParticleField } from '../../src/stdlib/scene/ParticleField.js'
import { noise2 } from '../../src/stdlib/math.js'

export class FlowParticles extends ParticleField {
  constructor({ count = 4000, width = 100, height = 60, speed = 1.5 } = {}) {
    super(count, { size: 1.2, opacity: 0.6 })
    this.width = width
    this.height = height
    this.speed = speed
    this.alpha = new Float32Array(count)
    this.swatch = new Three.Color()
    for (let i = 0; i < count; i++) this.spawn(i, Math.random() * 0.8)
    this.commit()
  }

  spawn(i, alpha = 0.8, time = 0) {
    const x = (Math.random() - 0.5) * this.width
    this.positions[i * 3] = x
    this.positions[i * 3 + 1] = (Math.random() - 0.5) * this.height
    this.alpha[i] = alpha
    this.swatch.setHSL(((x / this.width + 0.5) * 0.6 + 0.5 + time * 0.1) % 1, 0.7, 0.6)
    this.swatch.toArray(this.colors, i * 3)
  }

  update(dt, elapsed) {
    dt = Math.min(dt, 0.05)
    const time = elapsed * 0.04
    for (let i = 0; i < this.count; i++) {
      const offset = i * 3
      const angle = noise2(this.positions[offset] * 0.012 + time, this.positions[offset + 1] * 0.012 + time * 0.7) * Math.PI * 2
      this.positions[offset] += Math.cos(angle) * this.speed * dt
      this.positions[offset + 1] += Math.sin(angle) * this.speed * dt
      this.alpha[i] -= 0.18 * dt
      if (this.alpha[i] <= 0 || Math.abs(this.positions[offset]) > this.width / 2 || Math.abs(this.positions[offset + 1]) > this.height / 2) {
        this.spawn(i, 0.8, time)
      }
      const fade = Math.pow(0.98 + this.alpha[i] * 0.02, dt * 60)
      for (let channel = 0; channel < 3; channel++) this.colors[offset + channel] *= fade
    }
    this.commit()
  }
}

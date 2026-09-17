import * as Three from 'three'
import { InstanceField } from '../../src/stdlib/scene/InstanceField.js'

const BLUE = new Three.Color(0x426d91)
const WHITE = new Three.Color(0xeaf3f5)
const AMBER = new Three.Color(0xffad32)

/** One fixed instance buffer that transforms from architecture to swarm to lamp. */
export class SwarmField extends InstanceField {
  constructor(count = 1400) {
    super(count, new Three.TetrahedronGeometry(0.085, 0), new Three.MeshBasicMaterial({ vertexColors: true }))
    this.seed = Array.from({ length: count }, (_, i) => hash(i + 1))
    this.position = new Three.Vector3()
    this.swatch = new Three.Color()
    this.object.visible = false
    this.visibleCount = count
  }

  setDensity(scale) {
    this.visibleCount = Math.max(600, Math.round(this.count * scale))
    this.object.count = this.visibleCount
  }

  updateScore(position, activity) {
    const mode = position.part.id
    this.object.visible = mode !== 'invitation' && mode !== 'return'
    if (!this.object.visible) return
    const t = position.seconds
    const morph = ease(position.partProgress)
    for (let i = 0; i < this.visibleCount; i++) {
      const seed = this.seed[i]
      const angle = seed * Math.PI * 2 + t * (0.08 + (i % 9) * 0.002)
      const column = i % 28
      const tier = Math.floor(i / 28) % 20
      const tunnel = {
        x: (column - 13.5) * 0.55,
        y: (tier - 9.5) * 0.42,
        z: -3 - Math.floor(i / 560) * 8 - Math.sin(column * 1.7) * 1.5,
      }
      const radius = mode === 'climax' ? 3.4 + 2 * Math.sin(i * 0.17 + t) : 2.2 + seed * 5.5
      const swarm = {
        x: Math.cos(angle * 3) * radius,
        y: Math.sin(angle * 2 + seed * 8) * (1.2 + seed * 3.6),
        z: -7 + Math.sin(angle) * radius,
      }
      let target = swarm
      if (mode === 'break') target = tunnel
      if (mode === 'expansion') target = mixPoint(tunnel, swarm, morph)
      if (mode === 'reveal') {
        const sphere = spherePoint(i, this.count, 3.2 + Math.sin(t * 2) * 0.15)
        target = mixPoint(swarm, sphere, morph)
      }
      this.position.set(target.x, target.y, target.z)
      const flash = Math.max(activity.melody, activity.drums * 0.7)
      this.swatch.copy(BLUE).lerp(WHITE, seed * 0.6).lerp(AMBER, flash * (0.25 + seed * 0.55))
      this.set(i, this.position, 0.6 + seed * 1.5 + flash * 0.65, this.swatch)
    }
    this.commit()
  }
}

function hash(value) {
  const x = Math.sin(value * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function ease(value) {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function mixPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
}

function spherePoint(index, count, radius) {
  const y = 1 - (index / (count - 1)) * 2
  const ring = Math.sqrt(1 - y * y)
  const theta = Math.PI * (3 - Math.sqrt(5)) * index
  return { x: Math.cos(theta) * ring * radius, y: y * radius, z: -7 + Math.sin(theta) * ring * radius }
}

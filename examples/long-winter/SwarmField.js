import * as Three from 'three'
import { InstanceField } from '../../src/stdlib/scene/InstanceField.js'

const PALETTES = {
  'aurora-code': [0x20efb1, 0x3f82ff, 0xc14eff],
  'loose-pixel': [0xff9c32, 0xff416d, 0x623cff],
  'copper-tunnel': [0x00dcff, 0xff8b29, 0xe537a2],
  'color-storm': [0x00dfff, 0x783cff, 0xff2f9b],
}

/** One fixed buffer transforming through four recognizably different demo effects. */
export class SwarmField extends InstanceField {
  constructor(count = 1400) {
    super(count, new Three.TetrahedronGeometry(0.075, 0), new Three.MeshBasicMaterial({ vertexColors: true }))
    this.seed = Array.from({ length: count }, (_, i) => hash(i + 1))
    this.position = new Three.Vector3()
    this.swatch = new Three.Color()
    this.first = new Three.Color()
    this.second = new Three.Color()
    this.object.visible = false
    this.visibleCount = count
  }

  setDensity(scale) {
    this.visibleCount = Math.max(600, Math.round(this.count * scale))
    this.object.count = this.visibleCount
  }

  updateScore(position, activity) {
    const mode = position.act.id
    const palette = PALETTES[mode]
    this.object.visible = Boolean(palette)
    if (!palette) return
    const t = position.seconds
    const morph = ease(position.actProgress)
    for (let i = 0; i < this.visibleCount; i++) {
      const seed = this.seed[i]
      const target = pointFor(mode, i, seed, t, morph, this.count)
      this.position.set(target.x, target.y, target.z)
      const flash = Math.max(activity.melody, activity.drums * 0.65)
      this.first.set(palette[i % palette.length])
      this.second.set(palette[(i + 1) % palette.length])
      this.swatch.copy(this.first).lerp(this.second, seed).offsetHSL((t * 0.025 + seed * 0.08) % 1, 0, flash * 0.08)
      this.set(i, this.position, 0.58 + seed * 1.4 + flash * 0.42, this.swatch)
    }
    this.commit()
  }
}

function pointFor(mode, i, seed, t, morph, count) {
  const angle = seed * Math.PI * 2 + t * (0.12 + (i % 7) * 0.003)
  if (mode === 'aurora-code') {
    return { x: (seed - 0.5) * 18, y: Math.sin(seed * 36 + t * 1.3) * 1.7 + (i % 5) * 0.18, z: -7 + Math.sin(seed * 18) * 2 }
  }
  if (mode === 'loose-pixel') {
    const column = i % 32
    const tier = Math.floor(i / 32) % 22
    return { x: (column - 15.5) * 0.5 * (1 + morph), y: (tier - 10.5) * 0.36, z: -3 - Math.floor(i / 704) * 8 - Math.sin(column * 1.4 + t) }
  }
  if (mode === 'copper-tunnel') {
    const ring = i % 36
    const depth = Math.floor(i / 36)
    const radius = 2.2 + Math.sin(depth * 0.4 + t) * 0.45
    return { x: Math.cos(ring / 36 * Math.PI * 2) * radius, y: Math.sin(ring / 36 * Math.PI * 2) * radius, z: 2 - (depth * 0.55 + t * 5) % 22 }
  }
  const sphere = spherePoint(i, count, 3.1 + Math.sin(t * 1.6 + seed * 8) * 1.3)
  const helix = { x: Math.cos(angle * 4) * (2 + seed * 5), y: (seed - 0.5) * 8, z: -7 + Math.sin(angle * 4) * (2 + seed * 5) }
  return mixPoint(sphere, helix, 0.35 + Math.sin(t * 0.45) * 0.3)
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

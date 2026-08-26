import * as Three from 'three'
import { MAX_FRAGMENTS, MAX_HAZARDS } from './game.js'

const STAR_COUNT = 700

export function createSignalScene(ctx, texture) {
  return new SignalScene(ctx, texture)
}

class SignalScene {
  constructor(ctx, texture) {
    this._ctx = ctx
    this._disposed = false
    this._pulseLife = 0
    this._time = 0
    this.root = new Three.Group()
    this.root.name = 'signal-salvage'

    this._buildEnvironment()
    this._buildCraft()
    this._buildPools(texture)
    this._buildPulse()
    ctx.add(this.root)
  }

  setTexture(texture) {
    this._fragmentMaterial.map = texture
    this._fragmentMaterial.needsUpdate = true
  }

  sync(state, events, dt) {
    this._time += dt
    this.craft.position.x = state.player.x
    this.craft.position.y = state.player.y
    this.craft.rotation.z += ((-state.player.x * 0.035) - this.craft.rotation.z) * 0.08
    this.craft.rotation.x += ((state.player.y * 0.025) - this.craft.rotation.x) * 0.08
    this.craft.visible = state.invulnerableFor <= 0 || Math.floor(state.invulnerableFor * 12) % 2 === 0

    syncPool(this.fragmentPool, state.fragments, this._time, 0.7)
    syncPool(this.hazardPool, state.hazards, this._time, -0.45)
    this._updatePulse(events, dt)
    this._updateEnvironment(state)
  }

  dispose() {
    if (this._disposed) return
    this._disposed = true
    const geometries = new Set()
    const materials = new Set()
    this.root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry)
      if (Array.isArray(object.material)) object.material.forEach(item => materials.add(item))
      else if (object.material) materials.add(object.material)
    })
    geometries.forEach(geometry => geometry.dispose())
    materials.forEach(material => material.dispose())
    this._ctx.remove(this.root)
  }

  _buildEnvironment() {
    const positions = new Float32Array(STAR_COUNT * 3)
    const colors = new Float32Array(STAR_COUNT * 3)
    const color = new Three.Color()
    for (let i = 0; i < STAR_COUNT; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * 18
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * 11
      positions[i * 3 + 2] = -Math.random() * 80
      color.setHSL(0.45 + Math.random() * 0.22, 0.65, 0.55 + Math.random() * 0.35)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    const geometry = new Three.BufferGeometry()
    geometry.setAttribute('position', new Three.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Three.BufferAttribute(colors, 3))
    this._stars = new Three.Points(
      geometry,
      new Three.PointsMaterial({
        size: 0.08,
        transparent: true,
        opacity: 0.75,
        vertexColors: true,
        blending: Three.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this.root.add(this._stars)

    const nebulaMaterial = new Three.MeshBasicMaterial({
      color: 0x224455,
      transparent: true,
      opacity: 0.055,
      side: Three.BackSide,
      blending: Three.AdditiveBlending,
    })
    this._nebula = new Three.Mesh(new Three.IcosahedronGeometry(26, 2), nebulaMaterial)
    this._nebula.position.z = -22
    this.root.add(this._nebula)

    const ambient = new Three.AmbientLight(0x80aacc, 0.9)
    const glow = new Three.PointLight(0x66ffd0, 3.5, 35)
    glow.position.set(0, 2, 5)
    this.root.add(ambient, glow)
  }

  _buildCraft() {
    this.craft = new Three.Group()
    const bodyMaterial = new Three.MeshStandardMaterial({
      color: 0x9fffd7,
      emissive: 0x2edda5,
      emissiveIntensity: 2.5,
      roughness: 0.28,
      metalness: 0.05,
    })
    const membrane = new Three.MeshPhysicalMaterial({
      color: 0x7bb8ff,
      emissive: 0x204488,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.62,
      transmission: 0.2,
      side: Three.DoubleSide,
    })
    const body = new Three.Mesh(new Three.SphereGeometry(0.42, 20, 12), bodyMaterial)
    body.scale.set(0.75, 0.55, 1.8)
    const wingGeometry = new Three.CircleGeometry(1.15, 24, 0, Math.PI)
    const left = new Three.Mesh(wingGeometry, membrane)
    const right = new Three.Mesh(wingGeometry, membrane)
    left.position.x = -0.2
    right.position.x = 0.2
    left.rotation.z = Math.PI / 2
    right.rotation.z = -Math.PI / 2
    this.craft.add(body, left, right)
    this.craft.position.z = 0
    this.root.add(this.craft)
  }

  _buildPools(texture) {
    const fragmentGeometry = new Three.IcosahedronGeometry(0.48, 1)
    this._fragmentMaterial = new Three.MeshPhysicalMaterial({
      map: texture,
      color: 0xb8ffe9,
      emissive: 0x225544,
      emissiveIntensity: 1.8,
      roughness: 0.12,
      metalness: 0,
      transmission: 0.35,
      transparent: true,
      opacity: 0.86,
    })
    this.fragmentPool = makePool(
      this.root,
      MAX_FRAGMENTS,
      fragmentGeometry,
      this._fragmentMaterial,
    )

    const hazardGeometry = new Three.IcosahedronGeometry(0.68, 1)
    const hazardMaterial = new Three.MeshStandardMaterial({
      color: 0x8b206e,
      emissive: 0xff2080,
      emissiveIntensity: 2.1,
      roughness: 0.45,
      wireframe: true,
    })
    this.hazardPool = makePool(this.root, MAX_HAZARDS, hazardGeometry, hazardMaterial)
  }

  _buildPulse() {
    this._pulse = new Three.Mesh(
      new Three.TorusGeometry(1, 0.035, 8, 64),
      new Three.MeshBasicMaterial({
        color: 0x8effdc,
        transparent: true,
        opacity: 0,
        blending: Three.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this._pulse.rotation.x = Math.PI / 2
    this.root.add(this._pulse)
  }

  _updatePulse(events, dt) {
    const pulse = events.find(event => event.type === 'pulse')
    if (pulse) {
      this._pulseLife = 0.5
      this._pulse.scale.setScalar(0.5 + pulse.strength)
    }
    this._pulse.position.copy(this.craft.position)
    if (this._pulseLife <= 0) {
      this._pulse.material.opacity = 0
      return
    }
    this._pulseLife = Math.max(0, this._pulseLife - dt)
    this._pulse.scale.multiplyScalar(1 + dt * 8)
    this._pulse.material.opacity = this._pulseLife * 1.5
  }

  _updateEnvironment(state) {
    this._stars.position.z = (this._time * (2 + state.wave)) % 10
    this._nebula.rotation.y = this._time * 0.012
    this._nebula.rotation.z = this._time * -0.007
  }
}

function makePool(parent, count, geometry, material) {
  return Array.from({ length: count }, (_, index) => {
    const mesh = new Three.Mesh(geometry, material)
    mesh.visible = false
    mesh.userData.poolIndex = index
    parent.add(mesh)
    return mesh
  })
}

function syncPool(pool, entities, time, spin) {
  for (let i = 0; i < pool.length; i++) {
    const mesh = pool[i]
    const entity = entities[i]
    mesh.visible = Boolean(entity?.active)
    if (!mesh.visible) continue
    mesh.position.set(entity.x, entity.y, entity.z)
    mesh.rotation.x = time * spin + i
    mesh.rotation.y = time * spin * 1.3 + i * 0.7
    const breath = 0.9 + Math.sin(time * 3 + i) * 0.12
    mesh.scale.setScalar(breath)
  }
}

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
    this._geometries = new Set()
    this._materials = new Set()
    this.root = new Three.Group()
    this.root.name = 'signal-salvage'

    this._buildEnvironment(texture)
    this._buildCraft()
    this._buildPools(texture)
    this._buildPulse()
    ctx.add(this.root)
  }

  setTexture(texture) {
    this.signalVeil.material.map = texture
    this.signalVeil.material.needsUpdate = true
    this.fragmentMaterials.prism.map = texture
    this.fragmentMaterials.prism.needsUpdate = true
  }

  sync(state, events, dt, media = {}) {
    this._time += dt
    this.craft.position.x = state.player.x
    this.craft.position.y = state.player.y
    this.craft.rotation.z += ((-state.player.x * 0.035) - this.craft.rotation.z) * 0.08
    this.craft.rotation.x += ((state.player.y * 0.025) - this.craft.rotation.x) * 0.08
    this.craft.visible = state.invulnerableFor <= 0 || Math.floor(state.invulnerableFor * 12) % 2 === 0

    syncPool(this.fragmentPool, state.fragments, this._time, 0.7, this.fragmentVisuals)
    syncPool(this.hazardPool, state.hazards, this._time, -0.45, this.hazardVisuals)
    this._updatePulse(events, dt)
    this._updateEnvironment(state, media)
  }

  dispose() {
    if (this._disposed) return
    this._disposed = true
    this._geometries.forEach(geometry => geometry.dispose())
    this._materials.forEach(material => material.dispose())
    this._ctx.remove(this.root)
  }

  _buildEnvironment(texture) {
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
    const geometry = this._keepGeometry(new Three.BufferGeometry())
    geometry.setAttribute('position', new Three.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Three.BufferAttribute(colors, 3))
    this._stars = new Three.Points(
      geometry,
      this._keepMaterial(new Three.PointsMaterial({
        size: 0.08,
        transparent: true,
        opacity: 0.75,
        vertexColors: true,
        blending: Three.AdditiveBlending,
        depthWrite: false,
      })),
    )
    this.root.add(this._stars)

    const nebulaMaterial = this._keepMaterial(new Three.MeshBasicMaterial({
      color: 0x224455,
      transparent: true,
      opacity: 0.055,
      side: Three.BackSide,
      blending: Three.AdditiveBlending,
    }))
    this._nebula = new Three.Mesh(
      this._keepGeometry(new Three.IcosahedronGeometry(26, 2)),
      nebulaMaterial,
    )
    this._nebula.position.z = -22
    this.root.add(this._nebula)

    const veilMaterial = this._keepMaterial(new Three.MeshBasicMaterial({
      map: texture,
      color: 0x77bbcc,
      transparent: true,
      opacity: 0.16,
      side: Three.DoubleSide,
      blending: Three.AdditiveBlending,
      depthWrite: false,
    }))
    this.signalVeil = new Three.Mesh(
      this._keepGeometry(new Three.PlaneGeometry(22, 12, 24, 16)),
      veilMaterial,
    )
    this.signalVeil.position.z = -18
    this.root.add(this.signalVeil)

    const ambient = new Three.AmbientLight(0x80aacc, 0.9)
    this._glow = new Three.PointLight(0x66ffd0, 3.5, 35)
    this._glow.position.set(0, 2, 5)
    this.root.add(ambient, this._glow)
  }

  _buildCraft() {
    this.craft = new Three.Group()
    const bodyMaterial = this._keepMaterial(new Three.MeshStandardMaterial({
      color: 0x9fffd7,
      emissive: 0x2edda5,
      emissiveIntensity: 2.5,
      roughness: 0.28,
      metalness: 0.05,
    }))
    const membrane = this._keepMaterial(new Three.MeshPhysicalMaterial({
      color: 0x7bb8ff,
      emissive: 0x204488,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.62,
      transmission: 0.2,
      side: Three.DoubleSide,
    }))
    const body = new Three.Mesh(
      this._keepGeometry(new Three.SphereGeometry(0.42, 20, 12)),
      bodyMaterial,
    )
    body.scale.set(0.75, 0.55, 1.8)
    const wingGeometry = this._keepGeometry(new Three.CircleGeometry(1.15, 24, 0, Math.PI))
    const left = new Three.Mesh(wingGeometry, membrane)
    const right = new Three.Mesh(wingGeometry, membrane)
    left.position.x = -0.2
    right.position.x = 0.2
    left.rotation.z = Math.PI / 2
    right.rotation.z = -Math.PI / 2
    this.craft.add(body, left, right)
    this.aura = new Three.Mesh(
      this._keepGeometry(new Three.SphereGeometry(1.4, 18, 12)),
      this._keepMaterial(new Three.MeshBasicMaterial({
        color: 0x74ffdb,
        transparent: true,
        opacity: 0.08,
        wireframe: true,
        blending: Three.AdditiveBlending,
        depthWrite: false,
      })),
    )
    this.craft.add(this.aura)
    this.craft.position.z = 0
    this.root.add(this.craft)
  }

  _buildPools(texture) {
    const fragmentGeometries = {
      memory: this._keepGeometry(new Three.IcosahedronGeometry(0.48, 1)),
      resonance: this._keepGeometry(new Three.TorusKnotGeometry(0.3, 0.11, 32, 6)),
      prism: this._keepGeometry(new Three.TetrahedronGeometry(0.62, 1)),
      repair: this._keepGeometry(new Three.OctahedronGeometry(0.52, 1)),
    }
    this.fragmentMaterials = {
      memory: this._collectibleMaterial(0xb8ffe9, 0x225544),
      resonance: this._collectibleMaterial(0xffa8ee, 0x882266),
      prism: this._collectibleMaterial(0xffffff, 0x3366aa, texture),
      repair: this._collectibleMaterial(0xaaff88, 0x227733),
    }
    this.fragmentVisuals = Object.fromEntries(Object.keys(fragmentGeometries).map(kind => [
      kind,
      { geometry: fragmentGeometries[kind], material: this.fragmentMaterials[kind] },
    ]))
    this.fragmentPool = makePool(
      this.root,
      MAX_FRAGMENTS,
      fragmentGeometries.prism,
      this.fragmentMaterials.prism,
    )

    const hazardGeometries = {
      corruption: this._keepGeometry(new Three.IcosahedronGeometry(0.68, 1)),
      debris: this._keepGeometry(new Three.DodecahedronGeometry(0.66, 0)),
      gravity: this._keepGeometry(new Three.TorusGeometry(0.54, 0.2, 8, 20)),
    }
    const hazardMaterials = {
      corruption: this._hazardMaterial(0xff2080),
      debris: this._hazardMaterial(0xff8b3d),
      gravity: this._hazardMaterial(0x9955ff),
    }
    this.hazardVisuals = Object.fromEntries(Object.keys(hazardGeometries).map(kind => [
      kind,
      { geometry: hazardGeometries[kind], material: hazardMaterials[kind] },
    ]))
    this.hazardPool = makePool(
      this.root,
      MAX_HAZARDS,
      hazardGeometries.corruption,
      hazardMaterials.corruption,
    )
  }

  _buildPulse() {
    this._pulse = new Three.Mesh(
      this._keepGeometry(new Three.TorusGeometry(1, 0.035, 8, 64)),
      this._keepMaterial(new Three.MeshBasicMaterial({
        color: 0x8effdc,
        transparent: true,
        opacity: 0,
        blending: Three.AdditiveBlending,
        depthWrite: false,
      })),
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

  _updateEnvironment(state, media) {
    const motion = media.motion ?? { x: 0, y: 0, amount: 0 }
    const micEnergy = Math.max(0, Math.min(1, Number(media.micEnergy) || 0))
    this._stars.position.z = (this._time * (2 + state.wave + motion.amount * 3)) % 10
    this._stars.rotation.z += motion.amount * 0.004
    this._stars.material.size = 0.08 + motion.amount * 0.06
    this._nebula.rotation.y = this._time * 0.012
    this._nebula.rotation.z = this._time * -0.007
    this.signalVeil.position.x += (motion.x * 2.5 - this.signalVeil.position.x) * 0.12
    this.signalVeil.position.y += (motion.y * 1.8 - this.signalVeil.position.y) * 0.12
    this.signalVeil.rotation.z = this._time * 0.015 + motion.amount * 0.08
    const blackout = state.activeEvents?.some(event => event.type === 'blackout')
    const warning = Boolean(state.eventWarning)
    this.signalVeil.material.color.setHex(warning ? 0xff5577 : 0x77bbcc)
    this.signalVeil.material.opacity = (blackout ? 0.07 : 0.16)
      + micEnergy * 0.16
      + (warning ? 0.12 : 0)
    this._stars.material.opacity = blackout ? 0.2 : 0.75
    this._glow.intensity = 3.5 + micEnergy * 5
    this._glow.color.setHex(warning ? 0xff3355 : 0x66ffd0)
    this.aura.scale.setScalar(1 + micEnergy * 1.8 + state.pulseCharge * 0.4)
    this.aura.material.opacity = 0.08 + micEnergy * 0.3
  }

  _collectibleMaterial(color, emissive, map = null) {
    return this._keepMaterial(new Three.MeshPhysicalMaterial({
      map,
      color,
      emissive,
      emissiveIntensity: 1.8,
      roughness: 0.12,
      metalness: 0,
      transmission: 0.35,
      transparent: true,
      opacity: 0.86,
    }))
  }

  _hazardMaterial(emissive) {
    return this._keepMaterial(new Three.MeshStandardMaterial({
      color: 0x35162d,
      emissive,
      emissiveIntensity: 2.1,
      roughness: 0.45,
      wireframe: true,
    }))
  }

  _keepGeometry(geometry) {
    this._geometries.add(geometry)
    return geometry
  }

  _keepMaterial(material) {
    this._materials.add(material)
    return material
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

function syncPool(pool, entities, time, spin, visuals) {
  for (let i = 0; i < pool.length; i++) {
    const mesh = pool[i]
    const entity = entities[i]
    mesh.visible = Boolean(entity?.active)
    if (!mesh.visible) continue
    const visual = visuals[entity.kind] ?? Object.values(visuals)[0]
    mesh.geometry = visual.geometry
    mesh.material = visual.material
    mesh.position.set(entity.x, entity.y, entity.z)
    mesh.rotation.x = time * spin + i
    mesh.rotation.y = time * spin * 1.3 + i * 0.7
    const breath = 0.9 + Math.sin(time * 3 + i) * 0.12
    mesh.scale.setScalar(breath)
  }
}

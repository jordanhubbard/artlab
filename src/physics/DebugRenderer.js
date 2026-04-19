import * as THREE from 'three'
import { OrbitalWorld } from './OrbitalWorld.js'
import { RigidWorld } from './RigidWorld.js'
import { ParticleWorld } from './ParticleWorld.js'

const _MAT_ORBITAL  = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
const _MAT_RIGID    = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })
const _MAT_PARTICLE = new THREE.PointsMaterial({ color: 0x00ffff, size: 0.15 })

export class DebugRenderer {
  constructor(scene) {
    this._scene = scene
    this._group = new THREE.Group()
    this._group.name = '__physics_debug__'
    this._enabled = false
    scene.add(this._group)
    this._bodyMeshes = new Map()   // id → THREE.Object3D
  }

  toggle() { this._enabled = !this._enabled; this._group.visible = this._enabled }
  enable()  { this._enabled = true;  this._group.visible = true }
  disable() { this._enabled = false; this._group.visible = false }

  // Update debug overlays from a PhysicsComposer.
  // Call each frame after composer.step().
  update(composer) {
    if (!this._enabled) return

    const liveIds = new Set()

    for (const world of composer._worlds) {
      if (world instanceof OrbitalWorld) {
        this._updateOrbitalWorld(world, liveIds)
      } else if (world instanceof RigidWorld) {
        this._updateRigidWorld(world, liveIds)
      } else if (world instanceof ParticleWorld) {
        this._updateParticleWorld(world, liveIds)
      }
    }

    // Remove stale meshes for bodies that have been removed
    for (const [id, obj] of this._bodyMeshes) {
      if (!liveIds.has(id)) {
        this._group.remove(obj)
        obj.geometry?.dispose()
        this._bodyMeshes.delete(id)
      }
    }
  }

  _updateOrbitalWorld(world, liveIds) {
    for (const [id, body] of world._bodies) {
      liveIds.add(id)
      let mesh = this._bodyMeshes.get(id)
      if (!mesh) {
        const geo = new THREE.SphereGeometry(0.5, 8, 6)
        mesh = new THREE.Mesh(geo, _MAT_ORBITAL)
        this._group.add(mesh)
        this._bodyMeshes.set(id, mesh)
      }
      const { x, y, z } = body.position
      mesh.position.set(x, y, z)
    }
  }

  _updateRigidWorld(world, liveIds) {
    for (const [id, body] of world._bodies) {
      liveIds.add(id)
      let mesh = this._bodyMeshes.get(id)
      if (!mesh) {
        mesh = this._createRigidMesh(body.desc)
        this._group.add(mesh)
        this._bodyMeshes.set(id, mesh)
      }
      const { x, y, z } = body.position
      mesh.position.set(x, y, z)
      const r = body.rotation
      mesh.quaternion.set(r.x, r.y, r.z, r.w)
    }
  }

  _createRigidMesh(desc) {
    const shape = desc.shape ?? { type: 'box' }
    let geo
    if (shape.type === 'sphere') {
      const radius = shape.radius ?? 0.5
      geo = new THREE.SphereGeometry(radius, 8, 6)
    } else if (shape.type === 'capsule') {
      const radius = shape.radius ?? 0.3
      const height = shape.height ?? 1.0
      geo = new THREE.CapsuleGeometry(radius, height, 4, 8)
    } else {
      // default: box
      const hw = shape.halfExtents?.x ?? 0.5
      const hh = shape.halfExtents?.y ?? 0.5
      const hd = shape.halfExtents?.z ?? 0.5
      geo = new THREE.BoxGeometry(hw * 2, hh * 2, hd * 2)
    }
    return new THREE.Mesh(geo, _MAT_RIGID)
  }

  _updateParticleWorld(world, liveIds) {
    for (const [id, emitter] of world._emitters) {
      liveIds.add(id)
      let points = this._bodyMeshes.get(id)

      const particles = emitter.particles
      const count = particles.length

      if (!points) {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3))
        points = new THREE.Points(geo, _MAT_PARTICLE)
        this._group.add(points)
        this._bodyMeshes.set(id, points)
      }

      // Rebuild position buffer each frame to match live particle count
      const positions = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const p = particles[i]
        positions[i * 3]     = p.position.x
        positions[i * 3 + 1] = p.position.y
        positions[i * 3 + 2] = p.position.z
      }
      points.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      points.geometry.setDrawRange(0, count)
      points.geometry.attributes.position.needsUpdate = true
    }
  }

  dispose() {
    for (const obj of this._bodyMeshes.values()) {
      obj.geometry?.dispose()
    }
    this._scene.remove(this._group)
    this._bodyMeshes.clear()
  }
}

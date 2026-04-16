import * as THREE from 'three'
import { AU_SCALE, BELT_INNER_AU, BELT_OUTER_AU, BELT_COUNT } from '../utils/constants.js'

export class AsteroidBelt {
  constructor() {
    // Very low-poly icosahedra give a rocky look cheaply
    const geo = new THREE.IcosahedronGeometry(0.08, 0)
    const mat = new THREE.MeshStandardMaterial({
      color:    0x9A8B7A,
      roughness: 0.95,
      metalness: 0.05,
    })

    this.mesh = new THREE.InstancedMesh(geo, mat, BELT_COUNT)
    this.mesh.castShadow    = true
    this.mesh.receiveShadow = true

    const dummy   = new THREE.Object3D()
    this._offsets = new Float32Array(BELT_COUNT * 3)  // store initial positions for animation

    for (let i = 0; i < BELT_COUNT; i++) {
      const r     = (BELT_INNER_AU + Math.random() * (BELT_OUTER_AU - BELT_INNER_AU)) * AU_SCALE
      const angle = Math.random() * Math.PI * 2
      const y     = (Math.random() - 0.5) * 8   // belt thickness

      const x = r * Math.cos(angle)
      const z = r * Math.sin(angle)

      dummy.position.set(x, y, z)
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      )
      const s = 0.3 + Math.random() * 1.8
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      this.mesh.setMatrixAt(i, dummy.matrix)

      this._offsets[i * 3]     = angle
      this._offsets[i * 3 + 1] = r
      this._offsets[i * 3 + 2] = y
    }
    this.mesh.instanceMatrix.needsUpdate = true
    this._dummy = new THREE.Object3D()  // reused every frame
    // Pre-compute per-asteroid scale and rotation seed
    this._scales = new Float32Array(BELT_COUNT)
    this._rotSeeds = new Float32Array(BELT_COUNT * 3)
    for (let i = 0; i < BELT_COUNT; i++) {
      this._scales[i] = 0.3 + Math.sin(i * 0.7) * 0.7 + 0.7
      this._rotSeeds[i*3]   = (i * 0.137) % (Math.PI * 2)
      this._rotSeeds[i*3+1] = (i * 0.251) % (Math.PI * 2)
      this._rotSeeds[i*3+2] = (i * 0.389) % (Math.PI * 2)
    }
  }

  update(elapsed) {
    const dummy     = this._dummy
    const baseSpeed = 0.00008
    for (let i = 0; i < BELT_COUNT; i++) {
      const initAngle = this._offsets[i * 3]
      const r         = this._offsets[i * 3 + 1]
      const y         = this._offsets[i * 3 + 2]
      const speed     = baseSpeed * Math.sqrt(AU_SCALE * 2.5 / r)
      const angle     = initAngle + elapsed * speed
      dummy.position.set(r * Math.cos(angle), y, r * Math.sin(angle))
      // Per-asteroid rotation (slow tumble with unique seed per asteroid)
      const rs = i * 3
      dummy.rotation.set(
        this._rotSeeds[rs]   + elapsed * 0.02,
        this._rotSeeds[rs+1] + elapsed * 0.015,
        this._rotSeeds[rs+2] + elapsed * 0.025
      )
      dummy.scale.setScalar(this._scales[i])
      dummy.updateMatrix()
      this.mesh.setMatrixAt(i, dummy.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}

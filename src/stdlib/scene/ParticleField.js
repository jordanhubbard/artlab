import * as Three from 'three'

/** A reusable point cloud with fixed, directly editable position/color buffers. */
export class ParticleField {
  constructor(count, options = {}) {
    if (!Number.isInteger(count) || count < 1) throw new RangeError('Particle count must be a positive integer')
    this.count = count
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3).fill(1)
    const geometry = new Three.BufferGeometry()
    geometry.setAttribute('position', new Three.BufferAttribute(this.positions, 3).setUsage(Three.DynamicDrawUsage))
    geometry.setAttribute('color', new Three.BufferAttribute(this.colors, 3).setUsage(Three.DynamicDrawUsage))
    this.object = new Three.Points(geometry, new Three.PointsMaterial({
      size: 1, vertexColors: true, transparent: true, depthWrite: false,
      blending: Three.AdditiveBlending, ...options,
    }))
    // Positions move after construction; a cached bounding sphere would be stale.
    this.object.frustumCulled = false
  }

  commit() {
    this.object.geometry.attributes.position.needsUpdate = true
    this.object.geometry.attributes.color.needsUpdate = true
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.object.removeFromParent()
    this.object.geometry.dispose()
    this.object.material.dispose()
  }
}

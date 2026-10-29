import * as Three from 'three'

/** An ordered fixed-capacity trail; mirrored storage avoids shifting each frame. */
export class Trail {
  constructor(capacity = 64, options = {}) {
    if (!Number.isInteger(capacity) || capacity < 2) throw new RangeError('Trail capacity must be at least 2')
    this.capacity = capacity
    this.count = 0
    this.head = 0
    this.positions = new Float32Array(capacity * 6)
    const geometry = new Three.BufferGeometry()
    geometry.setAttribute('position', new Three.BufferAttribute(this.positions, 3).setUsage(Three.DynamicDrawUsage))
    geometry.setDrawRange(0, 0)
    this.object = new Three.Line(geometry, new Three.LineBasicMaterial(options))
    this.object.frustumCulled = false
  }

  push(position) {
    const { x, y, z } = position
    for (let copy = 0; copy < 2; copy++) {
      const offset = (this.head + copy * this.capacity) * 3
      this.positions[offset] = x
      this.positions[offset + 1] = y
      this.positions[offset + 2] = z
    }
    this.head = (this.head + 1) % this.capacity
    this.count = Math.min(this.count + 1, this.capacity)
    this.object.geometry.setDrawRange(this.count === this.capacity ? this.head : 0, this.count)
    this.object.geometry.attributes.position.needsUpdate = true
  }

  clear() {
    this.head = this.count = 0
    this.object.geometry.setDrawRange(0, 0)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.object.removeFromParent()
    this.object.geometry.dispose()
    this.object.material.dispose()
  }
}

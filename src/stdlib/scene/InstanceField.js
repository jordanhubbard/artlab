import * as Three from 'three'

/** Many copies of one mesh, submitted in one draw call per render pass. */
export class InstanceField {
  constructor(count, geometry, material) {
    if (!Number.isInteger(count) || count < 1) throw new RangeError('Instance count must be a positive integer')
    this.count = count
    this.object = new Three.InstancedMesh(geometry, material, count)
    this.object.instanceMatrix.setUsage(Three.DynamicDrawUsage)
    this.object.frustumCulled = false
    this.pose = new Three.Object3D()
    this.color = new Three.Color()
  }

  set(index, position, scale = 1, color = 0xffffff) {
    if (index < 0 || index >= this.count) throw new RangeError('Instance index out of range')
    this.pose.position.copy(position)
    this.pose.scale.setScalar(scale)
    this.pose.updateMatrix()
    this.object.setMatrixAt(index, this.pose.matrix)
    this.object.setColorAt(index, this.color.set(color))
  }

  commit() {
    this.object.instanceMatrix.needsUpdate = true
    if (this.object.instanceColor) this.object.instanceColor.needsUpdate = true
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.object.removeFromParent()
    this.object.dispose()
    this.object.geometry.dispose()
    this.object.material.dispose()
  }
}

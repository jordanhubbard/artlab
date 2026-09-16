import * as Three from 'three'

const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/** A fullscreen shader with automatic time and drawing-buffer resolution uniforms. */
export class ShaderSurface {
  constructor(renderer, fragmentShader, uniforms = {}) {
    this.renderer = renderer
    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new Three.Vector2() },
      ...uniforms,
    }
    this.object = new Three.Mesh(new Three.PlaneGeometry(2, 2), new Three.ShaderMaterial({
      vertexShader: VERTEX, fragmentShader, uniforms: this.uniforms,
      depthTest: false, depthWrite: false,
    }))
    this.object.frustumCulled = false
    this.update(0, 0)
  }

  update(dt, elapsed) {
    this.uniforms.uTime.value = elapsed
    const canvas = this.renderer.domElement
    this.uniforms.uResolution.value.set(Math.max(1, canvas.width), Math.max(1, canvas.height))
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.object.removeFromParent()
    this.object.geometry.dispose()
    this.object.material.dispose()
  }
}

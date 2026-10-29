import * as Three from 'three'

const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/** UV shader surface with time/resolution uniforms; fullscreen by default. */
export class ShaderSurface {
  /** @param {Pick<Three.WebGLRenderer, 'domElement'>} renderer
   * @param {string} fragmentShader @param {Record<string, Three.IUniform>} [uniforms]
   * @param {{ width?: number, height?: number, fullscreen?: boolean }} [options]
   */
  constructor(renderer, fragmentShader, uniforms = {}, { width = 2, height = 2, fullscreen = true } = {}) {
    this.renderer = renderer
    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new Three.Vector2() },
      ...uniforms,
    }
    this.object = new Three.Mesh(new Three.PlaneGeometry(width, height), new Three.ShaderMaterial({
      vertexShader: fullscreen ? VERTEX : 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader, uniforms: this.uniforms,
      side: Three.DoubleSide,
      depthTest: !fullscreen, depthWrite: !fullscreen,
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

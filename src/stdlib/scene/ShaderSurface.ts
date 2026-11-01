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
  readonly renderer: { domElement: Pick<HTMLCanvasElement, 'width' | 'height'> }
  readonly uniforms: Record<string, Three.IUniform> & {
    uTime: Three.IUniform<number>
    uResolution: Three.IUniform<Three.Vector2>
  }
  readonly object: Three.Mesh<Three.PlaneGeometry, Three.ShaderMaterial>
  private disposed = false
  /** @param {{ domElement: Pick<HTMLCanvasElement, 'width' | 'height'> }} renderer
   * @param {string} fragmentShader @param {Record<string, Three.IUniform>} [uniforms]
   * @param {{ width?: number, height?: number, fullscreen?: boolean }} [options]
   */
  constructor(renderer: { domElement: Pick<HTMLCanvasElement, 'width' | 'height'> }, fragmentShader: string, uniforms: Record<string, Three.IUniform> = {}, { width = 2, height = 2, fullscreen = true }: { width?: number; height?: number; fullscreen?: boolean } = {}) {
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

  update(dt: number, elapsed: number) {
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

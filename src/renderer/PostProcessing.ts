import * as Three from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import type { WebGPURenderer } from 'three/webgpu'

export class PostProcessor {
  private readonly _renderer: Three.WebGLRenderer | WebGPURenderer
  private readonly _scene: Three.Scene
  private readonly _camera: Three.Camera
  private readonly _isWebGPU: boolean
  enabled = false
  bloomPass: UnrealBloomPass | null = null
  composer?: EffectComposer
  constructor(renderer: Three.WebGLRenderer | WebGPURenderer, scene: Three.Scene, camera: Three.Camera) {
    this._renderer = renderer
    this._scene = scene
    this._camera = camera
    this._isWebGPU = 'isWebGPURenderer' in renderer && renderer.isWebGPURenderer === true
    this.enabled = false
    this.bloomPass = null

    if (renderer instanceof Three.WebGLRenderer) {
      this._initWebGL(renderer)
    } else {
      console.info('[post] WebGPU — direct render (no EffectComposer)')
    }
  }

  private _initWebGL(renderer: Three.WebGLRenderer) {
    try {
      this.composer = new EffectComposer(renderer)
      this.composer.addPass(new RenderPass(this._scene, this._camera))
      this.bloomPass = new UnrealBloomPass(
        new Three.Vector2(window.innerWidth, window.innerHeight),
        1.6, 0.6, 0.82
      )
      this.composer.addPass(this.bloomPass)
      this.composer.addPass(new OutputPass())
      this.enabled = true
      console.info('[post] EffectComposer + UnrealBloom active')
    } catch (e) {
      console.warn('[post] EffectComposer failed, using direct render:', e instanceof Error ? e.message : String(e))
    }
  }

  render(delta: number) {
    if (this.enabled && this.composer) {
      this.composer.render(delta)
    } else {
      this._renderer.render(this._scene, this._camera)
    }
  }

  resize(w: number, h: number) {
    if (this.enabled && this.composer) {
      this.composer.setSize(w, h)
      this.bloomPass?.setSize(w, h)
    }
  }

  setBloomStrength(v: number) {
    if (this.bloomPass) this.bloomPass.strength = v
  }
}

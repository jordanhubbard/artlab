import * as Three from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export class PostProcessor {
  constructor(renderer, scene, camera) {
    this._renderer = renderer
    this._scene = scene
    this._camera = camera
    this._isWebGPU = renderer.isWebGPURenderer === true
    this.enabled = false
    this.bloomPass = null

    if (!this._isWebGPU) {
      this._initWebGL(renderer)
    } else {
      console.info('[post] WebGPU — direct render (no EffectComposer)')
    }
  }

  _initWebGL(renderer) {
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
      console.warn('[post] EffectComposer failed, using direct render:', e.message)
    }
  }

  render(delta) {
    if (this.enabled) {
      this.composer.render(delta)
    } else {
      this._renderer.render(this._scene, this._camera)
    }
  }

  resize(w, h) {
    if (this.enabled) {
      this.composer.setSize(w, h)
      this.bloomPass?.setSize(w, h)
    }
  }

  setBloomStrength(v) {
    if (this.bloomPass) this.bloomPass.strength = v
  }
}

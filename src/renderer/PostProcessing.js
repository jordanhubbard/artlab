import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export class PostProcessor {
  constructor(renderer, scene, camera) {
    this._renderer = renderer
    this._scene = scene
    this._camera = camera

    // Try to use EffectComposer with bloom.
    // WebGPURenderer works with EffectComposer in compatibility mode;
    // if it fails we fall back to direct render.
    try {
      // EffectComposer requires calling the renderer's WebGL context.
      // With WebGPURenderer we need to check if it supports this.
      const isWebGPU = renderer.isWebGPURenderer === true
      if (isWebGPU) {
        // Use direct render for WebGPU — EffectComposer is WebGL-only
        console.info('[post] WebGPU detected — using direct render (no EffectComposer)')
        this.enabled = false
      } else {
        this.composer = new EffectComposer(renderer)
        this.composer.addPass(new RenderPass(scene, camera))

        this.bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          /* strength */ 1.6,
          /* radius   */ 0.6,
          /* threshold */ 0.82
        )
        this.composer.addPass(this.bloomPass)
        this.composer.addPass(new OutputPass())
        this.enabled = true
        console.info('[post] EffectComposer + UnrealBloom active')
      }
    } catch (e) {
      console.warn('[post] EffectComposer failed, using direct render:', e.message)
      this.enabled = false
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

  /** Adjust bloom strength reactively (called from audio pipeline) */
  setBloomStrength(v) {
    if (this.bloomPass) this.bloomPass.strength = v
  }
}

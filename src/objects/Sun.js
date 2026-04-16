import * as THREE from 'three'
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js'
import { SUN_RADIUS, SHADOW_MAP_SIZE } from '../utils/constants.js'
import sunCoronaVert from '../shaders/sun_corona.vert.glsl?raw'
import sunCoronaFrag from '../shaders/sun_corona.frag.glsl?raw'

export class Sun {
  constructor(texManager) {
    this.group = new THREE.Group()
    this._texManager = texManager

    // ── Core sphere ──────────────────────────────────────────────────
    const coreGeo = new THREE.SphereGeometry(SUN_RADIUS, 64, 64)
    const coreMat = new THREE.MeshStandardMaterial({
      map:            this._makeSunTexture(),
      emissive:       new THREE.Color(1.0, 0.75, 0.2),
      emissiveIntensity: 2.0,
      roughness: 1,
      metalness: 0,
    })
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat)
    this.coreMesh.castShadow    = false
    this.coreMesh.receiveShadow = false
    this.group.add(this.coreMesh)

    // ── Corona (outer glow sphere) ────────────────────────────────────
    const noiseTexture = this._makeNoiseTexture()
    this.coronaUniforms = {
      uTime:      { value: 0 },
      uAudioBass: { value: 0 },
      uNoiseMap:  { value: noiseTexture },
    }
    const coronaMat = new THREE.ShaderMaterial({
      uniforms:       this.coronaUniforms,
      vertexShader:   sunCoronaVert,
      fragmentShader: sunCoronaFrag,
      blending:       THREE.AdditiveBlending,
      transparent:    true,
      depthWrite:     false,
      side:           THREE.BackSide,
    })
    const coronaGeo = new THREE.SphereGeometry(SUN_RADIUS * 1.45, 48, 48)
    this.coronaMesh = new THREE.Mesh(coronaGeo, coronaMat)
    this.coronaMesh.castShadow    = false
    this.coronaMesh.receiveShadow = false
    this.group.add(this.coronaMesh)

    // Front-side corona (thinner outer halo)
    const haloMat = coronaMat.clone()
    haloMat.side = THREE.FrontSide
    haloMat.uniforms = this.coronaUniforms  // share uniforms
    const haloGeo = new THREE.SphereGeometry(SUN_RADIUS * 1.9, 48, 48)
    this.haloMesh = new THREE.Mesh(haloGeo, haloMat)
    this.haloMesh.castShadow = false
    this.group.add(this.haloMesh)

    // ── Point light (illuminates all planets) ────────────────────────
    this.light = new THREE.PointLight(0xFFEEBB, 3.5, 15000)
    this.light.castShadow = true
    this.light.shadow.mapSize.width  = SHADOW_MAP_SIZE
    this.light.shadow.mapSize.height = SHADOW_MAP_SIZE
    this.light.shadow.camera.near = 0.5
    this.light.shadow.camera.far  = 15000
    this.group.add(this.light)

    // ── Lens flare ───────────────────────────────────────────────────
    this._addLensflare()
  }

  _addLensflare() {
    const flareTexture = this._makeFlareDisk(256)
    const lensflare = new Lensflare()
    lensflare.addElement(new LensflareElement(flareTexture, 700, 0, new THREE.Color(1.0, 0.9, 0.6)))
    lensflare.addElement(new LensflareElement(flareTexture, 60,  0.4, new THREE.Color(0.9, 0.7, 0.4)))
    lensflare.addElement(new LensflareElement(flareTexture, 40,  0.7, new THREE.Color(0.7, 0.5, 1.0)))
    lensflare.addElement(new LensflareElement(flareTexture, 80,  1.0, new THREE.Color(0.4, 0.6, 1.0)))
    this.group.add(lensflare)
  }

  _makeSunTexture(size = 512) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
    grad.addColorStop(0,   '#FFFFFF')
    grad.addColorStop(0.3, '#FFF0A0')
    grad.addColorStop(0.6, '#FFB030')
    grad.addColorStop(1.0, '#FF4400')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    // Granulation noise
    const id = ctx.getImageData(0, 0, size, size)
    for (let i = 0; i < id.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 25
      id.data[i]   = Math.min(255, id.data[i]   + n)
      id.data[i+1] = Math.min(255, id.data[i+1] + n * 0.7)
      id.data[i+2] = Math.max(0,   id.data[i+2] + n * 0.2)
    }
    ctx.putImageData(id, 0, 0)
    return new THREE.CanvasTexture(canvas)
  }

  _makeNoiseTexture(size = 256) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    const id = ctx.createImageData(size, size)
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.random() * 255
      id.data[i] = id.data[i+1] = id.data[i+2] = v
      id.data[i+3] = 255
    }
    ctx.putImageData(id, 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    return tex
  }

  _makeFlareDisk(size = 256) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
    grad.addColorStop(0,   'rgba(255,255,255,1)')
    grad.addColorStop(0.2, 'rgba(255,220,150,0.8)')
    grad.addColorStop(0.5, 'rgba(255,120,50,0.3)')
    grad.addColorStop(1.0, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(canvas)
  }

  get position() { return this.group.position }

  update(elapsed, audioData = {}) {
    this.coronaUniforms.uTime.value      = elapsed
    this.coronaUniforms.uAudioBass.value = audioData.bass ?? 0
    this.coreMesh.rotation.y = elapsed * 0.004
  }
}

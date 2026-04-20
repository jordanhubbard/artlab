// shader-gallery.js — Virtual art gallery with five live shader paintings
import * as THREE from 'three'
import { pixelate, glitch } from '../../src/stdlib/video.js'

const ROOM_W = 16
const ROOM_H = 7
const ROOM_D = 12
const WALL_T = 0.4

const PAINT_W = 3.2
const PAINT_H = 2.4
const FRAME_T = 0.18
const FRAME_D = 0.12

// Module-level refs so teardown can reach them
let galleryGroup, ambientLight
let pixMat, glitchMat, wavesMat, fractalMat, noiseMat
let disposables

// ---------------------------------------------------------------------------
// Canvas helpers (used as texture source for pixelate + glitch paintings)
// ---------------------------------------------------------------------------

function makeColorCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const c = canvas.getContext('2d')
  if (!c) return canvas
  // Colorful mosaic grid
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      c.fillStyle = `hsl(${(i * 23 + j * 17) % 360}, 80%, 55%)`
      c.fillRect(i * 32, j * 32, 32, 32)
    }
  }
  // Radial gradient overlays
  for (let k = 0; k < 8; k++) {
    const x = (k * 73) % 512
    const y = (k * 97) % 512
    const r = 30 + k * 15
    const gr = c.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, `hsla(${k * 45}, 100%, 80%, 0.7)`)
    gr.addColorStop(1, `hsla(${(k * 45 + 180) % 360}, 100%, 30%, 0)`)
    c.fillStyle = gr
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fill()
  }
  return canvas
}

function makeGlitchCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const c = canvas.getContext('2d')
  if (!c) return canvas
  c.fillStyle = '#08081a'
  c.fillRect(0, 0, 512, 512)
  // Horizontal hue bands
  for (let y = 0; y < 512; y += 4) {
    c.fillStyle = `hsla(${(y / 512) * 300}, 90%, 60%, 0.35)`
    c.fillRect(0, y, 512, 2)
  }
  // Vertical color streaks
  for (let k = 0; k < 6; k++) {
    c.fillStyle = `hsla(${k * 60}, 100%, 70%, 0.8)`
    c.fillRect(k * 85 + 20, 0, 3, 512)
  }
  // Grid overlay
  c.strokeStyle = 'rgba(80, 180, 255, 0.25)'
  c.lineWidth = 1
  for (let g = 0; g < 512; g += 32) {
    c.beginPath(); c.moveTo(0, g); c.lineTo(512, g); c.stroke()
    c.beginPath(); c.moveTo(g, 0); c.lineTo(g, 512); c.stroke()
  }
  return canvas
}

// ---------------------------------------------------------------------------
// Inline GLSL shader materials
// ---------------------------------------------------------------------------

const _VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

function makeWavesMat() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: _VERT,
    fragmentShader: /* glsl */`
      uniform float time;
      varying vec2 vUv;
      void main() {
        float r = 0.5 + 0.5 * sin(vUv.x * 8.0 + time * 1.2);
        float g = 0.5 + 0.5 * sin(vUv.y * 6.0 + time * 0.8 + 2.094);
        float b = 0.5 + 0.5 * sin((vUv.x + vUv.y) * 5.0 + time * 1.5 + 4.189);
        gl_FragColor = vec4(r, g, b, 1.0);
      }
    `,
  })
}

function makeFractalMat() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: _VERT,
    fragmentShader: /* glsl */`
      uniform float time;
      varying vec2 vUv;

      vec2 cmul(vec2 a, vec2 b) {
        return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
      }

      void main() {
        vec2 uv = (vUv - 0.5) * 3.2;
        float t = time * 0.25;
        // Slowly drifting Julia set parameter
        vec2 c = vec2(0.355 + 0.1 * sin(t), 0.355 + 0.1 * cos(t * 0.7));
        vec2 z = uv;
        int iter = 64;
        for (int i = 0; i < 64; i++) {
          z = cmul(z, z) + c;
          if (dot(z, z) > 4.0) { iter = i; break; }
        }
        float f = float(iter) / 64.0;
        // Smooth palette cycling; interior points (f=1.0) become black
        vec3 col = 0.5 + 0.5 * cos(6.283 * (vec3(0.0, 0.33, 0.67) + f * 3.0 + time * 0.15));
        col *= 1.0 - step(0.999, f);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
}

function makeNoiseMat() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: _VERT,
    fragmentShader: /* glsl */`
      uniform float time;
      varying vec2 vUv;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i),           hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      void main() {
        vec2 uv = vUv * 6.0;
        float t = time * 0.8;
        float n = noise(uv + vec2(t * 0.3, t * 0.7));
        n += 0.5  * noise(uv * 2.0 + vec2( t * 0.5, -t * 0.3));
        n += 0.25 * noise(uv * 4.0 + vec2(-t * 0.7,  t * 0.2));
        n /= 1.75;
        // Occasional TV-static flash
        float s = hash(vUv + vec2(time * 3.7, time * 1.3));
        n = mix(n, s, 0.15 * (0.5 + 0.5 * sin(time * 2.0)));
        vec3 col = mix(vec3(0.9, 0.1, 0.4), vec3(0.1, 0.9, 0.4), n);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
}

// ---------------------------------------------------------------------------
// Room and painting builders
// ---------------------------------------------------------------------------

function addWall(parent, w, h, d, x, y, z) {
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.9 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  disposables.push(geo, mat)
}

// Mounts a painting plane + gold/dark-wood frame + a warm point light on the wall.
// rotY controls which direction the painting face (0 = back wall, ±π/2 = side walls).
function addPainting(parent, x, y, z, rotY, mat, frameColor = 0xc9a84c) {
  const group = new THREE.Group()
  group.position.set(x, y, z)
  group.rotation.y = rotY

  const pGeo = new THREE.PlaneGeometry(PAINT_W, PAINT_H)
  group.add(new THREE.Mesh(pGeo, mat))
  disposables.push(pGeo)

  // Frame: 4 thin bars slightly proud of the painting plane (local +z)
  const fMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.35, metalness: 0.65 })
  disposables.push(fMat)
  const FZ = 0.05
  for (const sy of [-1, 1]) {
    const geo = new THREE.BoxGeometry(PAINT_W + FRAME_T * 2, FRAME_T, FRAME_D)
    const bar = new THREE.Mesh(geo, fMat)
    bar.position.set(0, sy * (PAINT_H / 2 + FRAME_T / 2), FZ)
    group.add(bar)
    disposables.push(geo)
  }
  for (const sx of [-1, 1]) {
    const geo = new THREE.BoxGeometry(FRAME_T, PAINT_H, FRAME_D)
    const bar = new THREE.Mesh(geo, fMat)
    bar.position.set(sx * (PAINT_W / 2 + FRAME_T / 2), 0, FZ)
    group.add(bar)
    disposables.push(geo)
  }

  // Warm spotlight above and slightly in front of the painting
  const light = new THREE.PointLight(0xfff4d0, 2.2, 5.5)
  light.position.set(0, 1.5, 1.4)
  group.add(light)

  parent.add(group)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function setup(ctx) {
  disposables = []

  ctx.camera.position.set(0, 2.5, 7)
  ctx.camera.lookAt(0, 2, 0)
  if (ctx.controls) ctx.controls.target.set(0, 2, 0)

  // Soft warm ambient
  ambientLight = new THREE.AmbientLight(0xffe8cc, 0.4)
  ctx.add(ambientLight)

  // Root group — a single ctx.remove() clears the whole room
  galleryGroup = new THREE.Group()
  ctx.add(galleryGroup)

  // Floor (dark wood)
  const floorGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a2112, roughness: 0.88, metalness: 0.05 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  galleryGroup.add(floor)
  disposables.push(floorGeo, floorMat)

  // Three walls (back, left, right) — open front lets the camera look in
  addWall(galleryGroup, ROOM_W, ROOM_H, WALL_T,           0, ROOM_H / 2, -ROOM_D / 2)  // back
  addWall(galleryGroup, WALL_T, ROOM_H, ROOM_D, -ROOM_W / 2, ROOM_H / 2,            0)  // left
  addWall(galleryGroup, WALL_T, ROOM_H, ROOM_D,  ROOM_W / 2, ROOM_H / 2,            0)  // right

  const BZ = -ROOM_D / 2 + WALL_T / 2 + 0.05   // z for back-wall paintings
  const LX = -ROOM_W / 2 + WALL_T / 2 + 0.05   // x for left-wall paintings
  const RX =  ROOM_W / 2 - WALL_T / 2 - 0.05   // x for right-wall paintings

  // 1. Pixelate (stdlib) — back wall left, gold frame
  const pixTex = new THREE.CanvasTexture(makeColorCanvas())
  pixMat = pixelate(pixTex, 20)
  addPainting(galleryGroup, -4.5, 3, BZ, 0, pixMat)
  disposables.push(pixTex, pixMat)

  // 2. Animated color waves (custom GLSL) — back wall center, gold frame
  wavesMat = makeWavesMat()
  addPainting(galleryGroup, 0, 3, BZ, 0, wavesMat)
  disposables.push(wavesMat)

  // 3. Glitch (stdlib) — back wall right, dark-wood frame
  const glitchTex = new THREE.CanvasTexture(makeGlitchCanvas())
  glitchMat = glitch(glitchTex, { intensity: 0.025, speed: 1.4 })
  addPainting(galleryGroup, 4.5, 3, BZ, 0, glitchMat, 0x2a1a0a)
  disposables.push(glitchTex, glitchMat)

  // 4. Julia fractal (custom GLSL) — left wall
  fractalMat = makeFractalMat()
  addPainting(galleryGroup, LX, 3, -1, Math.PI / 2, fractalMat)
  disposables.push(fractalMat)

  // 5. Animated noise (custom GLSL) — right wall
  noiseMat = makeNoiseMat()
  addPainting(galleryGroup, RX, 3, -1, -Math.PI / 2, noiseMat)
  disposables.push(noiseMat)
}

export function update(ctx, dt) {   // eslint-disable-line no-unused-vars
  const t = ctx.elapsed
  // Pixelate block size pulses gently
  if (pixMat) pixMat.uniforms.blockSize.value = 10 + 14 * Math.abs(Math.sin(t * 0.4))
  if (glitchMat) glitchMat.uniforms.time.value = t
  if (wavesMat)  wavesMat.uniforms.time.value  = t
  if (fractalMat) fractalMat.uniforms.time.value = t
  if (noiseMat)  noiseMat.uniforms.time.value  = t
}

export function teardown(ctx) {
  ctx.remove(ambientLight)
  ctx.remove(galleryGroup)
  for (const d of disposables) d.dispose?.()
  ambientLight = null
  galleryGroup = null
  pixMat = glitchMat = wavesMat = fractalMat = noiseMat = null
  disposables = []
}

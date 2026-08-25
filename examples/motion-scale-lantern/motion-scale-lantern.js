// Webcam-mapped scale lantern — hinged plates sample the frame by spherical direction.
import * as Three from 'three'
import { webcam } from '../../src/stdlib/video.js'

const SCALE_COUNT = 48

const VERT = /* glsl */`
  varying vec3 vWorldNormal;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */`
  uniform sampler2D map;
  uniform float darken;
  varying vec3 vWorldNormal;
  void main() {
    vec3 n = normalize(vWorldNormal);
    float u = atan(n.z, n.x) / 6.2831853 + 0.5;
    float v = acos(clamp(n.y, -1.0, 1.0)) / 3.14159265;
    vec4 col = texture2D(map, vec2(u, v));
    gl_FragColor = vec4(col.rgb * darken, 1.0);
  }
`

let added = []
let scales = []
let inner = null
let cam = null
let startBtn = null
let frozen = false
let motion = new Float32Array(SCALE_COUNT)
let prevSample = new Float32Array(SCALE_COUNT)
let sampleCanvas = null
let sampleCtx2d = null
let onKey = null

function fibonacciPoints(n) {
  const pts = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    pts.push(new Three.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r))
  }
  return pts
}

function styleButton(btn) {
  btn.style.cssText = [
    'position:absolute', 'bottom:50%', 'left:50%', 'transform:translate(-50%,50%)',
    'background:rgba(10,12,30,0.92)', 'border:1px solid rgba(120,180,255,0.45)',
    'color:#aaddff', 'padding:14px 44px', 'cursor:pointer', 'z-index:100',
    'font-family:monospace', 'letter-spacing:0.22em', 'font-size:13px',
    'border-radius:4px',
  ].join(';')
}

function awaitGesture(container) {
  return new Promise(resolve => {
    const btn = document.createElement('button')
    btn.textContent = 'Allow Camera'
    styleButton(btn)
    startBtn = btn
    container.appendChild(btn)
    btn.addEventListener('click', () => { btn.remove(); startBtn = null; resolve() }, { once: true })
  })
}

function sampleMotion(video) {
  if (!video || !video.videoWidth || !sampleCtx2d) return
  sampleCtx2d.drawImage(video, 0, 0, 32, 24)
  const { data } = sampleCtx2d.getImageData(0, 0, 32, 24)
  for (let i = 0; i < SCALE_COUNT; i++) {
    const u = Math.floor(((i * 7) % 32))
    const v = Math.floor((i / SCALE_COUNT) * 24)
    const idx = (v * 32 + u) * 4
    const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / (3 * 255)
    const delta = Math.abs(lum - prevSample[i])
    prevSample[i] = lum
    if (!frozen) motion[i] = motion[i] * 0.82 + delta * 4
  }
}

export async function setup(ctx) {
  ctx.setHelp('Allow Camera  •  F: freeze motion pose  •  drag to orbit')
  ctx.setBloom(0.45)
  ctx.camera.position.set(0, 0.4, 7)
  ctx.camera.lookAt(0, 0, 0)

  const amb = new Three.AmbientLight(0x334466, 1.1)
  ctx.add(amb)
  added.push(amb)
  const lamp = new Three.PointLight(0xffe6cc, 2.2, 12)
  lamp.position.set(0, 0, 0)
  ctx.add(lamp)
  added.push(lamp)

  const container = ctx.renderer.domElement.parentElement
  container.style.position = 'relative'

  if (!navigator.mediaDevices?.getUserMedia) return
  await awaitGesture(container)

  cam = webcam({ width: 640, height: 480 })
  const tex = cam.texture

  inner = new Three.Mesh(
    new Three.IcosahedronGeometry(1.35, 1),
    new Three.ShaderMaterial({
      uniforms: { map: { value: tex }, darken: { value: 0.55 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: Three.FrontSide,
    }),
  )
  ctx.add(inner)
  added.push(inner)

  const pts = fibonacciPoints(SCALE_COUNT)
  const geo = new Three.PlaneGeometry(0.42, 0.52)
  scales = pts.map((dir, i) => {
    const mat = new Three.ShaderMaterial({
      uniforms: { map: { value: tex }, darken: { value: 1.0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: Three.DoubleSide,
    })
    const mesh = new Three.Mesh(geo, mat)
    mesh.userData.dir = dir.clone()
    mesh.userData.index = i
    mesh.position.copy(dir).multiplyScalar(1.7)
    mesh.lookAt(0, 0, 0)
    mesh.rotateY(Math.PI)
    ctx.add(mesh)
    added.push(mesh)
    return mesh
  })

  sampleCanvas = document.createElement('canvas')
  sampleCanvas.width = 32
  sampleCanvas.height = 24
  sampleCtx2d = sampleCanvas.getContext('2d', { willReadFrequently: true })

  onKey = (e) => {
    if (e.key === 'f' || e.key === 'F') frozen = !frozen
  }
  window.addEventListener('keydown', onKey)
}

export function update(ctx, dt) {
  const t = ctx.elapsed
  sampleMotion(cam?.video)
  inner?.rotateY(dt * 0.08)
  for (const mesh of scales) {
    const i = mesh.userData.index
    const dir = mesh.userData.dir
    const breath = 0.08 * Math.sin(t * 1.4 + i * 0.35)
    const flare = Math.min(0.55, motion[i] + breath)
    mesh.position.copy(dir).multiplyScalar(1.7 + flare)
    mesh.lookAt(0, 0, 0)
    mesh.rotateY(Math.PI)
    mesh.rotateX(-flare * 0.9)
  }
}

export function teardown(ctx) {
  window.removeEventListener('keydown', onKey)
  startBtn?.remove()
  startBtn = null
  cam?.stop()
  cam = null
  for (const obj of added) ctx.remove(obj)
  added = []
  scales = []
  inner = null
  frozen = false
}

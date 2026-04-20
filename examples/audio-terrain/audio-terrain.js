// audio-terrain — terrain displaced by live mic FFT; sine-wave fallback without mic.
import * as Three from 'three'

const SEGS = 64
const SIZE = 20
const FFT_SIZE = 256

function amplitudeColor(y, maxY) {
  const t = Math.min(1, Math.max(0, y / (maxY + 0.001)))
  // dark teal → bright cyan/yellow
  const r = t * t * 0.9
  const g = 0.3 + t * 0.7
  const b = 1.0 - t * 0.5
  return [r, g, b]
}

export async function setup(ctx) {
  ctx.camera.position.set(0, 12, 18)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(1.0)

  const ambient = new Three.AmbientLight(0x050a14, 1.5)
  ctx.add(ambient)
  const pt = new Three.PointLight(0x44aaff, 2.0, 50)
  pt.position.set(0, 10, 0)
  ctx.add(pt)
  ctx._lights = [ambient, pt]

  // Terrain
  const geo = new Three.PlaneGeometry(SIZE, SIZE, SEGS, SEGS)
  geo.rotateX(-Math.PI / 2)
  const count = geo.attributes.position.count
  const colors = new Float32Array(count * 3)
  geo.setAttribute('color', new Three.BufferAttribute(colors, 3))
  geo.attributes.color.setUsage(Three.DynamicDrawUsage)
  geo.attributes.position.setUsage(Three.DynamicDrawUsage)

  const mat = new Three.MeshStandardMaterial({
    vertexColors: true,
    roughness:    0.6,
    metalness:    0.2,
    wireframe:    false,
  })
  ctx._terrain = new Three.Mesh(geo, mat)
  ctx.add(ctx._terrain)

  // Audio setup
  ctx._analyser  = null
  ctx._fftData   = null
  ctx._audioCtx  = null
  ctx._stream    = null

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    ctx._stream  = stream
    ctx._audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const source  = ctx._audioCtx.createMediaStreamSource(stream)
    const analyser = ctx._audioCtx.createAnalyser()
    analyser.fftSize = FFT_SIZE
    source.connect(analyser)
    ctx._analyser = analyser
    ctx._fftData  = new Uint8Array(analyser.frequencyBinCount)
  } catch (_e) {
    // No mic — fallback to sine waves
    ctx._analyser = null
  }

  ctx._camAngle = 0
}

export function update(ctx, dt) {
  const pos = ctx._terrain.geometry.attributes.position
  const col = ctx._terrain.geometry.attributes.color

  const S1 = SEGS + 1
  let maxY = 0.1

  for (let row = 0; row < S1; row++) {
    let fftVal = 0

    if (ctx._analyser && ctx._fftData) {
      ctx._analyser.getByteFrequencyData(ctx._fftData)
      const band = Math.floor((row / S1) * ctx._fftData.length)
      fftVal = ctx._fftData[band] / 255.0 * 5.0
    } else {
      // Fallback: sine wave landscape
      fftVal = (Math.sin(ctx.elapsed * 1.2 + row * 0.4) * 0.5 + 0.5) * 3.0
             + (Math.sin(ctx.elapsed * 0.7 - row * 0.3) * 0.3) * 1.0
    }

    for (let col_ = 0; col_ < S1; col_++) {
      const i = row * S1 + col_
      const xFactor = Math.sin((col_ / S1) * Math.PI)
      const y = fftVal * xFactor
      pos.setY(i, y)
      if (y > maxY) maxY = y
    }
  }

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const [r, g, b] = amplitudeColor(y, maxY)
    col.setXYZ(i, r, g, b)
  }

  pos.needsUpdate = true
  col.needsUpdate = true
  ctx._terrain.geometry.computeVertexNormals()

  // Slow camera orbit
  ctx._camAngle += dt * 0.15
  ctx.camera.position.set(
    Math.sin(ctx._camAngle) * 18,
    10,
    Math.cos(ctx._camAngle) * 18,
  )
  ctx.camera.lookAt(0, 1, 0)
}

export function teardown(ctx) {
  ctx.remove(ctx._terrain)
  for (const l of ctx._lights) ctx.remove(l)
  if (ctx._stream) ctx._stream.getTracks().forEach(t => t.stop())
  if (ctx._audioCtx) ctx._audioCtx.close()
}

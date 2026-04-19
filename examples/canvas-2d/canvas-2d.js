// Canvas 2D — a generative painting (concentric rings + Lissajous) rendered live onto a 3D plane.

import * as Three from 'three'

const SIZE = 512

function drawFrame(ctx2d, elapsed) {
  ctx2d.fillStyle = 'rgba(0,0,0,0.18)'
  ctx2d.fillRect(0, 0, SIZE, SIZE)

  const cx = SIZE / 2, cy = SIZE / 2

  for (let i = 0; i < 20; i++) {
    const r    = 10 + i * 11.5
    const hue  = ((elapsed * 0.04 + i / 20) % 1) * 360
    const glow = `hsl(${hue},90%,60%)`
    ctx2d.beginPath()
    ctx2d.arc(cx, cy, r, 0, Math.PI * 2)
    ctx2d.strokeStyle = glow
    ctx2d.lineWidth   = 1.2 + 0.6 * Math.sin(elapsed * 0.7 + i)
    ctx2d.stroke()
  }

  const pts = 200
  ctx2d.beginPath()
  for (let k = 0; k <= pts; k++) {
    const t  = (k / pts) * Math.PI * 2
    const lx = cx + Math.sin(3 * t + elapsed) * (cx * 0.72)
    const ly = cy + Math.sin(2 * t)            * (cy * 0.72)
    k === 0 ? ctx2d.moveTo(lx, ly) : ctx2d.lineTo(lx, ly)
  }
  ctx2d.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx2d.lineWidth   = 1.0
  ctx2d.stroke()
}

export function setup(ctx) {
  ctx.camera.position.set(0, 0, 12)
  ctx.camera.lookAt(0, 0, 0)

  ctx.add(new Three.AmbientLight(0x222222, 1.0))
  const pt = new Three.PointLight(0xffffff, 1.2, 30)
  pt.position.set(4, 6, 8)
  ctx.add(pt)
  ctx._pt = pt

  ctx._canvas2d = document.createElement('canvas')
  ctx._canvas2d.width  = SIZE
  ctx._canvas2d.height = SIZE
  ctx._ctx2d = ctx._canvas2d.getContext('2d')
  ctx._ctx2d.fillStyle = '#000'
  ctx._ctx2d.fillRect(0, 0, SIZE, SIZE)

  ctx._texture = new Three.CanvasTexture(ctx._canvas2d)

  const geo = new Three.PlaneGeometry(8, 8)
  const mat = new Three.MeshBasicMaterial({ map: ctx._texture })
  ctx._plane = new Three.Mesh(geo, mat)
  ctx.add(ctx._plane)
}

export function update(ctx, dt) {
  drawFrame(ctx._ctx2d, ctx.elapsed)
  ctx._texture.needsUpdate = true
  ctx._plane.rotation.y += 0.2 * dt
}

export function teardown(ctx) {
  ctx.remove(ctx._plane)
  ctx.remove(ctx._pt)
  ctx._plane.geometry.dispose()
  ctx._plane.material.dispose()
  ctx._texture.dispose()
}

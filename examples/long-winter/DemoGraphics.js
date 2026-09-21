import * as Three from 'three'

const COLORS = [0x00e5ff, 0x7657ff, 0xff3ea5, 0xff9e2c, 0x4dff91]

/** Copper bars, checker planes, and vector balls in the Amiga demo tradition. */
export class DemoGraphics {
  constructor() {
    this.object = new Three.Group()
    this.bars = new Three.Group()
    this.balls = new Three.Group()
    this.checker = buildChecker()
    for (let i = 0; i < 18; i++) {
      const bar = new Three.Mesh(new Three.PlaneGeometry(24, 0.15 + (i % 3) * 0.04), new Three.MeshBasicMaterial({ color: COLORS[i % COLORS.length], transparent: true, opacity: 0.62 }))
      bar.position.set(0, -4 + i * 0.48, -11 - (i % 2) * 0.1)
      this.bars.add(bar)
    }
    const ballGeometry = new Three.SphereGeometry(0.34, 10, 7)
    for (let i = 0; i < 28; i++) {
      const ball = new Three.Mesh(ballGeometry, new Three.MeshBasicMaterial({ color: COLORS[i % COLORS.length] }))
      ball.userData.phase = i / 28 * Math.PI * 2
      this.balls.add(ball)
    }
    this.object.add(this.bars, this.balls, this.checker)
    this.object.visible = false
  }

  update(_dt, position, activity) {
    const active = position.act.id === 'copper-tunnel' || position.act.id === 'color-storm'
    this.object.visible = active
    if (!active) return
    const t = position.seconds
    this.bars.visible = position.act.id === 'copper-tunnel'
    this.checker.visible = position.act.id === 'copper-tunnel'
    for (let i = 0; i < this.bars.children.length; i++) {
      const bar = this.bars.children[i]
      bar.position.x = Math.sin(t * 2.2 + i * 0.55) * 1.4
      bar.material.color.set(COLORS[(i + Math.floor(t * 4)) % COLORS.length])
    }
    for (let i = 0; i < this.balls.children.length; i++) {
      const ball = this.balls.children[i]
      const phase = ball.userData.phase
      const radius = position.act.id === 'color-storm' ? 3.5 + Math.sin(t * 1.7 + i) : 5.5
      ball.position.set(Math.cos(phase + t * 0.7) * radius, Math.sin(phase * 3 + t * 1.1) * 2.7, -6 + Math.sin(phase + t * 0.7) * radius)
      ball.scale.setScalar(0.75 + activity.drums * 0.45)
      ball.material.color.set(COLORS[(i + Math.floor(t * 3)) % COLORS.length])
    }
    this.checker.position.z = (t * 4) % 1.2
  }
}

function buildChecker() {
  const columns = 15
  const rows = 14
  const mesh = new Three.InstancedMesh(
    new Three.PlaneGeometry(1.2, 1.2),
    new Three.MeshBasicMaterial({ vertexColors: true, side: Three.DoubleSide }),
    columns * rows,
  )
  const pose = new Three.Object3D()
  const colors = [new Three.Color(0x10143a), new Three.Color(0x6a1686)]
  let index = 0
  for (let z = 0; z < rows; z++) {
    for (let x = -7; x <= 7; x++) {
      pose.position.set(x * 1.2, -3, -z * 1.2)
      pose.rotation.x = -Math.PI / 2
      pose.updateMatrix()
      mesh.setMatrixAt(index, pose.matrix)
      mesh.setColorAt(index, colors[(x + z) & 1])
      index++
    }
  }
  return mesh
}

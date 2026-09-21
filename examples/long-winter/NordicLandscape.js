import * as Three from 'three'

const PALETTES = {
  'blue-hour': [0x071526, 0x183653, 0x7394aa],
  'hearth-song': [0x10182b, 0x344a65, 0xf29b45],
  'fjord-mirror': [0x030b18, 0x173955, 0x8ab8c8],
  'aurora-code': [0x041326, 0x116466, 0x9b4dba],
  'birch-run': [0x10253b, 0x496a82, 0xe77b56],
  'first-light': [0x182640, 0xc15c68, 0xf6b95f],
}

/** A recurring northern landscape: fjord, red cabin, pines, birch, snow, and aurora. */
export class NordicLandscape {
  constructor() {
    this.object = new Three.Group()
    this.object.name = 'Nordic winter landscape'
    this.sky = flat(new Three.PlaneGeometry(42, 24), 0x071526)
    this.sky.position.set(0, 3, -19)
    this.mountains = [
      mountain(0x12283e, -16, 1.5, 2.7, 1),
      mountain(0x1e3d55, -13, -0.2, 2.1, 7),
      mountain(0x31566c, -10, -1.3, 1.5, 13),
    ]
    this.lake = new Three.Mesh(
      new Three.PlaneGeometry(34, 22, 1, 1),
      new Three.MeshStandardMaterial({ color: 0x102d45, roughness: 0.22, metalness: 0.5, transparent: true, opacity: 0.92 }),
    )
    this.lake.rotation.x = -Math.PI / 2
    this.lake.position.set(0, -2.72, -5)
    this.moon = flat(new Three.CircleGeometry(1.15, 32), 0xf3c879)
    this.moon.position.set(6, 4.8, -9.8)
    this.cabin = buildCabin()
    this.cabin.position.set(-3.6, -1.55, -2.5)
    this.trees = buildTrees()
    this.birches = buildBirches()
    this.snow = buildSnow(520)
    this.aurora = buildAurora()
    this.object.add(this.sky, ...this.mountains, this.lake, this.moon, this.cabin, this.trees, this.birches, this.snow, this.aurora)
  }

  update(dt, position, activity) {
    const id = position.act.id
    const landscapeAct = id === 'blue-hour' || id === 'hearth-song' || id === 'fjord-mirror' || id === 'aurora-code' || id === 'birch-run' || id === 'first-light'
    this.object.visible = landscapeAct
    if (!landscapeAct) return
    const palette = PALETTES[id]
    this.sky.material.color.lerp(new Three.Color(palette[0]), Math.min(1, dt * 2))
    this.mountains[1].material.color.lerp(new Three.Color(palette[1]), Math.min(1, dt * 2))
    this.moon.material.color.set(palette[2])
    this.moon.scale.setScalar(1 + activity.chord * 0.04)
    this.cabin.visible = id === 'blue-hour' || id === 'hearth-song' || id === 'first-light'
    this.birches.visible = id === 'birch-run'
    this.aurora.visible = id === 'aurora-code' || id === 'fjord-mirror'
    this.trees.position.x = id === 'birch-run' ? ((position.seconds * 3) % 8) - 4 : 0
    updateSnow(this.snow, dt, id === 'color-storm' ? 3 : 1)
    for (let i = 0; i < this.aurora.children.length; i++) {
      const ribbon = this.aurora.children[i]
      const positions = ribbon.geometry.attributes.position
      for (let j = 0; j < positions.count; j++) {
        const baseX = positions.getX(j)
        const row = j % 2
        positions.setY(j, row * 1.5 + Math.sin(baseX * 0.42 + position.seconds * 0.7 + i) * (0.5 + i * 0.11))
      }
      positions.needsUpdate = true
      ribbon.material.opacity = 0.2 + activity.melody * 0.16
    }
  }
}

function flat(geometry, color) {
  return new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color, side: Three.DoubleSide }))
}

function mountain(color, z, y, scale, seed) {
  const shape = new Three.Shape()
  shape.moveTo(-16, -5)
  for (let i = 0; i <= 16; i++) {
    const x = -16 + i * 2
    const peak = 1.2 + hash(seed + i) * 3 + (i % 3 === 0 ? 1.4 : 0)
    shape.lineTo(x, peak)
  }
  shape.lineTo(16, -5)
  const mesh = flat(new Three.ShapeGeometry(shape), color)
  mesh.position.set(0, y, z)
  mesh.scale.y = scale
  return mesh
}

function buildCabin() {
  const group = new Three.Group()
  const walls = new Three.Mesh(new Three.BoxGeometry(2.5, 1.5, 1.7), new Three.MeshStandardMaterial({ color: 0x8e2528, roughness: 0.88 }))
  const roof = new Three.Mesh(new Three.ConeGeometry(1.8, 1.05, 4), new Three.MeshStandardMaterial({ color: 0x172333, roughness: 0.75 }))
  roof.rotation.y = Math.PI / 4
  roof.position.y = 1.18
  const windowMaterial = new Three.MeshBasicMaterial({ color: 0xffb53f })
  for (const x of [-0.62, 0.62]) {
    const window = new Three.Mesh(new Three.PlaneGeometry(0.48, 0.52), windowMaterial)
    window.position.set(x, 0.1, 0.856)
    group.add(window)
  }
  const chimney = new Three.Mesh(new Three.BoxGeometry(0.28, 1.1, 0.28), new Three.MeshStandardMaterial({ color: 0x382c31 }))
  chimney.position.set(0.68, 1.25, 0)
  group.add(walls, roof, chimney)
  return group
}

function buildTrees() {
  const group = new Three.Group()
  const pose = new Three.Object3D()
  for (let tier = 0; tier < 3; tier++) {
    const cones = new Three.InstancedMesh(
      new Three.ConeGeometry(0.7 - tier * 0.12, 1, 6),
      new Three.MeshStandardMaterial({ color: tier === 0 ? 0x173c3d : 0x0b302f, roughness: 0.9 }),
      24,
    )
    for (let i = 0; i < 24; i++) {
      const size = 0.55 + hash(i + 31) * 1.25
      pose.position.set(-11 + hash(i + 3) * 22, -2.2 + tier * size * 0.48, -2.5 - hash(i + 19) * 6)
      pose.scale.setScalar(size)
      pose.rotation.set(0, 0, 0)
      pose.updateMatrix()
      cones.setMatrixAt(i, pose.matrix)
    }
    group.add(cones)
  }
  return group
}

function buildBirches() {
  const count = 34
  const bark = new Three.MeshBasicMaterial({ color: 0xcbd6d1 })
  const birches = new Three.InstancedMesh(new Three.CylinderGeometry(0.045, 0.065, 1, 5), bark, count)
  const pose = new Three.Object3D()
  for (let i = 0; i < count; i++) {
    const height = 3.8 + hash(i) * 2.5
    pose.position.set(-12 + hash(i + 4) * 24, -0.4, -1 - hash(i + 10) * 8)
    pose.rotation.z = (hash(i + 20) - 0.5) * 0.08
    pose.scale.set(1, height, 1)
    pose.updateMatrix()
    birches.setMatrixAt(i, pose.matrix)
  }
  birches.visible = false
  return birches
}

function buildSnow(count) {
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = -13 + hash(i + 2) * 26
    positions[i * 3 + 1] = -3 + hash(i + 20) * 13
    positions[i * 3 + 2] = -1 - hash(i + 50) * 14
    speeds[i] = 0.35 + hash(i + 80) * 0.8
  }
  const geometry = new Three.BufferGeometry()
  geometry.setAttribute('position', new Three.BufferAttribute(positions, 3))
  const points = new Three.Points(geometry, new Three.PointsMaterial({ color: 0xddeaf0, size: 0.055, transparent: true, opacity: 0.62, depthWrite: false }))
  points.userData.speeds = speeds
  return points
}

function updateSnow(snow, dt, force) {
  const positions = snow.geometry.attributes.position
  for (let i = 0; i < positions.count; i++) {
    let y = positions.getY(i) - snow.userData.speeds[i] * dt * force
    let x = positions.getX(i) + Math.sin(y * 0.7 + i) * dt * 0.18
    if (y < -3) {
      y = 10
      x = -13 + hash(i + 120) * 26
    }
    positions.setXY(i, x, y)
  }
  positions.needsUpdate = true
}

function buildAurora() {
  const group = new Three.Group()
  const colors = [0x28efbb, 0x43a7ff, 0xc65dff, 0x65ff8f]
  for (let i = 0; i < colors.length; i++) {
    const geometry = new Three.PlaneGeometry(24, 1.5, 40, 1)
    const ribbon = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color: colors[i], transparent: true, opacity: 0.24, side: Three.DoubleSide, blending: Three.AdditiveBlending, depthWrite: false }))
    ribbon.position.set((i - 1.5) * 1.4, 3.2 - i * 0.22, -8.5 + i * 0.25)
    ribbon.rotation.z = (i - 1.5) * 0.08
    group.add(ribbon)
  }
  group.visible = false
  return group
}

function hash(value) {
  const x = Math.sin(value * 127.1) * 43758.5453
  return x - Math.floor(x)
}

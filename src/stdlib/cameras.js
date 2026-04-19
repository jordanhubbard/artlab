import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// ---------------------------------------------------------------------------
// Shared helper: build a PerspectiveCamera from options
// ---------------------------------------------------------------------------
function makeCamera({ fov = 55, near = 0.1, far = 200000, aspect } = {}) {
  const a = aspect ?? (typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1)
  return new THREE.PerspectiveCamera(fov, a, near, far)
}

// ---------------------------------------------------------------------------
// OrbitCamera — thin wrapper around the existing CameraSystem pattern,
// exposed as a stdlib factory so DSL programs don't import CameraSystem directly.
// ---------------------------------------------------------------------------
export function OrbitCamera(renderer, opts = {}) {
  const camera = makeCamera(opts)
  camera.position.set(15, 5, 20)
  camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping  = true
  controls.dampingFactor  = 0.06
  controls.minDistance    = opts.minDistance ?? 2
  controls.maxDistance    = opts.maxDistance ?? 8000
  controls.zoomSpeed      = opts.zoomSpeed   ?? 1.2
  controls.rotateSpeed    = opts.rotateSpeed ?? 0.5

  function setTarget(objOrVec3) {
    const pos = objOrVec3.isObject3D ? objOrVec3.position : objOrVec3
    controls.target.copy(pos)
  }

  function update(delta) {
    if (controls.enabled) controls.update(delta)
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize)
  }

  return { camera, controls, update, setTarget, onResize }
}

// ---------------------------------------------------------------------------
// FlyCamera — WASD + Q/E movement, mouse-button-held look
// ---------------------------------------------------------------------------
export function FlyCamera(renderer, opts = {}) {
  const speed = opts.speed ?? 50   // units per second
  const camera = makeCamera(opts)
  camera.position.set(0, 0, 50)

  // Key state
  const keys = {}
  function onKeyDown(e) { keys[e.code] = true }
  function onKeyUp(e)   { keys[e.code] = false }
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup',   onKeyUp)

  // Mouse look state
  let looking    = false
  let lastX      = 0
  let lastY      = 0
  const euler    = new THREE.Euler(0, 0, 0, 'YXZ')
  const sensitivity = opts.sensitivity ?? 0.002

  function onMouseDown(e) {
    looking = true
    lastX = e.clientX
    lastY = e.clientY
  }
  function onMouseUp()   { looking = false }
  function onMouseMove(e) {
    if (!looking) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    euler.setFromQuaternion(camera.quaternion)
    euler.y -= dx * sensitivity
    euler.x -= dy * sensitivity
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x))
    camera.quaternion.setFromEuler(euler)
  }

  const el = renderer.domElement
  el.addEventListener('mousedown', onMouseDown)
  el.addEventListener('mouseup',   onMouseUp)
  el.addEventListener('mousemove', onMouseMove)
  // Also release on window so dragging outside canvas still releases
  window.addEventListener('mouseup', onMouseUp)

  const _move = new THREE.Vector3()

  function update(delta) {
    _move.set(0, 0, 0)

    if (keys['KeyW'] || keys['ArrowUp'])    _move.z -= 1
    if (keys['KeyS'] || keys['ArrowDown'])  _move.z += 1
    if (keys['KeyA'] || keys['ArrowLeft'])  _move.x -= 1
    if (keys['KeyD'] || keys['ArrowRight']) _move.x += 1
    if (keys['KeyQ'])                       _move.y -= 1
    if (keys['KeyE'])                       _move.y += 1

    if (_move.lengthSq() > 0) {
      _move.normalize().multiplyScalar(speed * delta)
      camera.translateX(_move.x)
      camera.translateY(_move.y)
      camera.translateZ(_move.z)
    }
  }

  function setTarget(objOrVec3) {
    const pos = objOrVec3.isObject3D ? objOrVec3.position : objOrVec3
    camera.lookAt(pos)
    euler.setFromQuaternion(camera.quaternion)
  }

  function dispose() {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup',   onKeyUp)
    el.removeEventListener('mousedown', onMouseDown)
    el.removeEventListener('mouseup',   onMouseUp)
    el.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize)
  }

  return { camera, update, setTarget, dispose, onResize }
}

// ---------------------------------------------------------------------------
// PathCamera — follows a THREE.CatmullRomCurve3
// ---------------------------------------------------------------------------
export function PathCamera(curve, opts = {}) {
  const camera   = makeCamera(opts)
  const speed    = opts.speed    ?? 0.1   // t-units per second (0→1 range)
  let   autoPlay = opts.autoPlay ?? true
  let   t        = opts.startT   ?? 0
  const lookAhead = opts.lookAhead ?? 0.01 // how far ahead on curve to look

  function update(delta) {
    if (autoPlay) {
      t = (t + speed * delta) % 1
    }
    const pos    = curve.getPoint(t)
    const ahead  = curve.getPoint((t + lookAhead) % 1)
    camera.position.copy(pos)
    camera.lookAt(ahead)
  }

  function setTarget(_obj) {
    // PathCamera is curve-driven; setTarget is a no-op but provided for API compat
  }

  function seek(newT) {
    t = Math.max(0, Math.min(1, newT))
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize)
  }

  return {
    camera,
    update,
    setTarget,
    seek,
    get t() { return t },
    set t(v) { t = Math.max(0, Math.min(1, v)) },
    get autoPlay() { return autoPlay },
    set autoPlay(v) { autoPlay = v },
    onResize,
  }
}

// ---------------------------------------------------------------------------
// CinematicCamera — keyframe timeline: addKeyframe(t, pos, target), seek(t)
// ---------------------------------------------------------------------------
export function CinematicCamera(opts = {}) {
  const camera    = makeCamera(opts)
  const keyframes = []   // [{ t, pos: Vector3, target: Vector3 }], sorted by t

  function addKeyframe(t, pos, target) {
    const kf = {
      t,
      pos:    pos    instanceof THREE.Vector3 ? pos    : new THREE.Vector3(...pos),
      target: target instanceof THREE.Vector3 ? target : new THREE.Vector3(...target),
    }
    keyframes.push(kf)
    keyframes.sort((a, b) => a.t - b.t)
  }

  const _pos    = new THREE.Vector3()
  const _target = new THREE.Vector3()

  function seek(t) {
    if (keyframes.length === 0) return
    if (keyframes.length === 1) {
      camera.position.copy(keyframes[0].pos)
      camera.lookAt(keyframes[0].target)
      return
    }

    // Clamp to range
    const first = keyframes[0]
    const last  = keyframes[keyframes.length - 1]
    if (t <= first.t) {
      camera.position.copy(first.pos)
      camera.lookAt(first.target)
      return
    }
    if (t >= last.t) {
      camera.position.copy(last.pos)
      camera.lookAt(last.target)
      return
    }

    // Find surrounding keyframes
    let lo = first
    let hi = last
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (keyframes[i].t <= t && keyframes[i + 1].t >= t) {
        lo = keyframes[i]
        hi = keyframes[i + 1]
        break
      }
    }

    const span  = hi.t - lo.t
    const alpha = span === 0 ? 0 : (t - lo.t) / span

    _pos.lerpVectors(lo.pos, hi.pos, alpha)
    _target.lerpVectors(lo.target, hi.target, alpha)

    camera.position.copy(_pos)
    camera.lookAt(_target)
  }

  // Timeline playback state
  let currentT  = 0
  let playing   = false
  let duration  = opts.duration ?? 1  // total timeline duration in seconds

  function play()  { playing = true  }
  function pause() { playing = false }

  function update(delta) {
    if (playing) {
      currentT += delta / duration
      if (currentT >= 1) {
        currentT = opts.loop ? currentT % 1 : 1
        if (!opts.loop) playing = false
      }
    }
    seek(currentT)
  }

  function setTarget(objOrVec3) {
    // For API compat — moves camera to look at object without changing position
    const pos = objOrVec3.isObject3D ? objOrVec3.position : objOrVec3
    camera.lookAt(pos)
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize)
  }

  return {
    camera,
    addKeyframe,
    seek,
    play,
    pause,
    update,
    setTarget,
    onResize,
    get currentT()  { return currentT },
    set currentT(v) { currentT = v; seek(v) },
    get duration()  { return duration },
    set duration(v) { duration = v },
    get playing()   { return playing },
  }
}

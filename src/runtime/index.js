/**
 * Artlab Runtime Core
 *
 * Ties together the renderer, physics, and assets through:
 *   - EventBus       — typed pub/sub for decoupled inter-system communication
 *   - InputManager   — keyboard, mouse, touch normalization
 *   - TimeManager    — frame dt, elapsed time, fixed-step physics clock
 *   - SceneNode      — scene graph node wrapping THREE.Object3D
 *   - RootScene      — top-level scene graph node (owns THREE.Scene)
 *   - AnimationSystem — keyframe tweens + audio-reactive bindings
 *
 * Quick start:
 *   import { createRuntime } from './runtime/index.js'
 *   const { bus, time, input, anim, scene } = createRuntime(canvas)
 *
 *   function loop(timestamp) {
 *     time.tick(timestamp)
 *     while (time.fixedStep()) { physics.step(time.elapsed, time.fixedDt) }
 *     anim.update(time.dt)
 *     bus.emit('scene:update', { elapsed: time.elapsed, dt: time.dt })
 *     renderer.render(scene.threeScene, camera)
 *     requestAnimationFrame(loop)
 *   }
 *   requestAnimationFrame(loop)
 */

export { EventBus, globalBus }      from './EventBus.js'
export { InputManager }             from './InputManager.js'
export { TimeManager }              from './TimeManager.js'
export { SceneNode, RootScene }     from './SceneNode.js'
export { AnimationSystem, Tween, ReactiveBinding } from './AnimationSystem.js'
export { SceneLoader }              from './SceneLoader.js'

// Re-export for convenience so callers don't need to import EventBus separately
import { EventBus } from './EventBus.js'
import { InputManager } from './InputManager.js'
import { TimeManager } from './TimeManager.js'
import { AnimationSystem } from './AnimationSystem.js'
import { RootScene } from './SceneNode.js'

/**
 * Create a minimal Artlab runtime instance wired together and ready to use.
 *
 * @param {HTMLElement} canvas  The canvas (or any element) to attach input to
 * @param {object} [options]
 * @param {number} [options.fixedDt=1/60]  Fixed physics step size in seconds
 * @param {number} [options.timeScale=1]   Initial time scale
 * @returns {{ bus: EventBus, time: TimeManager, input: InputManager, anim: AnimationSystem, scene: RootScene }}
 */
export function createRuntime(canvas, options = {}) {
  const bus   = new EventBus()
  const time  = new TimeManager()
  const input = new InputManager(canvas, bus)
  const anim  = new AnimationSystem(bus)
  const scene = new RootScene()

  if (options.fixedDt  !== undefined) time.fixedDt  = options.fixedDt
  if (options.timeScale !== undefined) time.timeScale = options.timeScale

  input.attach()

  return { bus, time, input, anim, scene }
}

/**
 * EventBus — typed pub/sub event system.
 * Used by all Artlab systems to communicate without coupling.
 *
 * Core events:
 *   scene:ready       - scene fully loaded,           payload: { scene }
 *   scene:update      - each frame,                   payload: { elapsed, dt }
 *   scene:destroy     - scene being torn down,        payload: (none)
 *   input:key         - key event,                    payload: { key, state: 'down'|'up', repeat: boolean, originalEvent }
 *   input:pointer     - mouse/touch,                  payload: { x, y, ndcX, ndcY, buttons, type: 'move'|'down'|'up' }
 *   input:wheel       - scroll,                       payload: { delta, originalEvent }
 *   physics:collision - bodies collided,              payload: { a, b }
 *   audio:beat        - beat detected,                payload: { band: 'bass'|'mid'|'high', strength: 0–1 }
 *   audio:fft         - each frame,                   payload: { bass, mid, high, data: Float32Array }
 *   package:loaded    - package ready,                payload: { manifest }
 *   package:error     - load failed,                  payload: { error }
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} event name → Set of handlers */
    this._listeners = new Map()
  }

  /**
   * Subscribe to an event.
   * @param {string} event  e.g. 'audio:beat', 'input:key', 'physics:collision', 'scene:update'
   * @param {Function} handler
   * @returns {Function} unsubscribe function
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    this._listeners.get(event).add(handler)
    return () => this.off(event, handler)
  }

  /**
   * Subscribe once — auto-unsubscribes after first fire.
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe function
   */
  once(event, handler) {
    const wrapper = (payload) => {
      this.off(event, wrapper)
      handler(payload)
    }
    // Store the original so callers can off() with the original handler
    wrapper._original = handler
    return this.on(event, wrapper)
  }

  /**
   * Unsubscribe a specific handler.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    const listeners = this._listeners.get(event)
    if (!listeners) return
    // Support removing by original handler (registered via once())
    for (const fn of listeners) {
      if (fn === handler || fn._original === handler) {
        listeners.delete(fn)
        break
      }
    }
    if (listeners.size === 0) {
      this._listeners.delete(event)
    }
  }

  /**
   * Fire an event with a payload.
   * @param {string} event
   * @param {*} [payload]
   */
  emit(event, payload) {
    const listeners = this._listeners.get(event)
    if (!listeners || listeners.size === 0) return
    // Snapshot to avoid mutation during iteration
    for (const handler of [...listeners]) {
      try {
        handler(payload)
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err)
      }
    }
  }

  /**
   * Remove all listeners for an event, or all events if no arg.
   * @param {string} [event]
   */
  clear(event) {
    if (event === undefined) {
      this._listeners.clear()
    } else {
      this._listeners.delete(event)
    }
  }

  /**
   * Returns the number of listeners currently registered for an event.
   * Useful for debugging / tests.
   * @param {string} event
   * @returns {number}
   */
  listenerCount(event) {
    return this._listeners.get(event)?.size ?? 0
  }
}

/** Singleton EventBus for global use across Artlab systems. */
export const globalBus = new EventBus()

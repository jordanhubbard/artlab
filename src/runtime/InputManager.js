import { EventBus } from './EventBus.js'

/**
 * InputManager — normalizes keyboard, mouse, touch, and gamepad input.
 * Fires events on EventBus with normalized payloads.
 *
 * Emits:
 *   input:key     { key, state: 'down'|'up', repeat: boolean, originalEvent }
 *   input:pointer { x, y, ndcX, ndcY, buttons, type: 'move'|'down'|'up' }
 *   input:wheel   { delta, originalEvent }
 */
export class InputManager {
  /**
   * @param {HTMLElement} target - element to attach listeners to (usually canvas)
   * @param {EventBus} bus
   */
  constructor(target, bus) {
    this._target = target
    this._bus = bus
    /** @type {Set<string>} currently held keys (lowercase) */
    this._keys = new Set()
    this._pointerPos = { x: 0, y: 0, ndcX: 0, ndcY: 0 }
    /** @type {Map<string, Set<string>>} action name → set of keys */
    this._bindings = new Map()
    this._attached = false

    // Bind handlers once so we can remove them later
    this._onKeyDown = this._onKeyDown.bind(this)
    this._onKeyUp = this._onKeyUp.bind(this)
    this._onMouseMove = this._onMouseMove.bind(this)
    this._onMouseDown = this._onMouseDown.bind(this)
    this._onMouseUp = this._onMouseUp.bind(this)
    this._onWheel = this._onWheel.bind(this)
    this._onTouchStart = this._onTouchStart.bind(this)
    this._onTouchMove = this._onTouchMove.bind(this)
    this._onTouchEnd = this._onTouchEnd.bind(this)
    this._onContextMenu = this._onContextMenu.bind(this)
  }

  /**
   * Attach all event listeners to the target element.
   */
  attach() {
    if (this._attached) return
    this._attached = true

    // Keyboard events go on window so they fire regardless of focus
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)

    // Pointer events go on the target element
    this._target.addEventListener('mousemove', this._onMouseMove)
    this._target.addEventListener('mousedown', this._onMouseDown)
    this._target.addEventListener('mouseup', this._onMouseUp)
    this._target.addEventListener('wheel', this._onWheel, { passive: false })
    this._target.addEventListener('contextmenu', this._onContextMenu)

    // Touch events
    this._target.addEventListener('touchstart', this._onTouchStart, { passive: false })
    this._target.addEventListener('touchmove', this._onTouchMove, { passive: false })
    this._target.addEventListener('touchend', this._onTouchEnd, { passive: false })
  }

  /**
   * Remove all event listeners.
   */
  detach() {
    if (!this._attached) return
    this._attached = false

    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)

    this._target.removeEventListener('mousemove', this._onMouseMove)
    this._target.removeEventListener('mousedown', this._onMouseDown)
    this._target.removeEventListener('mouseup', this._onMouseUp)
    this._target.removeEventListener('wheel', this._onWheel)
    this._target.removeEventListener('contextmenu', this._onContextMenu)

    this._target.removeEventListener('touchstart', this._onTouchStart)
    this._target.removeEventListener('touchmove', this._onTouchMove)
    this._target.removeEventListener('touchend', this._onTouchEnd)

    this._keys.clear()
  }

  /**
   * Returns true if the given key is currently held down.
   * @param {string} key  key name (case-insensitive, e.g. 'arrowup', 'space', 'a')
   * @returns {boolean}
   */
  isKeyDown(key) {
    return this._keys.has(key.toLowerCase())
  }

  /**
   * Current pointer position in element-local pixels and NDC.
   * @returns {{ x: number, y: number, ndcX: number, ndcY: number }}
   */
  get pointer() {
    return { ...this._pointerPos }
  }

  /**
   * Bind an action name to one or more keys.
   * Multiple calls with the same action accumulate keys (OR logic).
   * @param {string} action  e.g. 'jump'
   * @param {string} key     e.g. 'Space' or ' '
   */
  bind(action, key) {
    if (!this._bindings.has(action)) {
      this._bindings.set(action, new Set())
    }
    this._bindings.get(action).add(key.toLowerCase())
  }

  /**
   * Returns true if any key bound to the given action is currently held.
   * @param {string} action
   * @returns {boolean}
   */
  isAction(action) {
    const keys = this._bindings.get(action)
    if (!keys) return false
    for (const key of keys) {
      if (this._keys.has(key)) return true
    }
    return false
  }

  // -------------------------------------------------------------------------
  // Private event handlers
  // -------------------------------------------------------------------------

  _onKeyDown(e) {
    const key = e.key.toLowerCase()
    if (this._keys.has(key)) return  // repeat suppression
    this._keys.add(key)
    this._bus.emit('input:key', { key, state: 'down', repeat: false, originalEvent: e })
  }

  _onKeyUp(e) {
    const key = e.key.toLowerCase()
    this._keys.delete(key)
    this._bus.emit('input:key', { key, state: 'up', repeat: false, originalEvent: e })
  }

  _onMouseMove(e) {
    const payload = this._pointerPayload(e.clientX, e.clientY, e.buttons, 'move')
    this._bus.emit('input:pointer', payload)
  }

  _onMouseDown(e) {
    const payload = this._pointerPayload(e.clientX, e.clientY, e.buttons, 'down')
    this._bus.emit('input:pointer', payload)
  }

  _onMouseUp(e) {
    const payload = this._pointerPayload(e.clientX, e.clientY, e.buttons, 'up')
    this._bus.emit('input:pointer', payload)
  }

  _onWheel(e) {
    this._bus.emit('input:wheel', { delta: e.deltaY, originalEvent: e })
  }

  _onTouchStart(e) {
    if (e.touches.length > 0) {
      const t = e.touches[0]
      const payload = this._pointerPayload(t.clientX, t.clientY, 1, 'down')
      this._bus.emit('input:pointer', payload)
    }
  }

  _onTouchMove(e) {
    if (e.touches.length > 0) {
      const t = e.touches[0]
      const payload = this._pointerPayload(t.clientX, t.clientY, 1, 'move')
      this._bus.emit('input:pointer', payload)
    }
  }

  _onTouchEnd(e) {
    // Use changedTouches for the last known position
    if (e.changedTouches.length > 0) {
      const t = e.changedTouches[0]
      const payload = this._pointerPayload(t.clientX, t.clientY, 0, 'up')
      this._bus.emit('input:pointer', payload)
    }
  }

  _onContextMenu(e) {
    e.preventDefault()
  }

  /**
   * Build a normalized pointer payload and update _pointerPos.
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} buttons
   * @param {'move'|'down'|'up'} type
   * @returns {{ x, y, ndcX, ndcY, buttons, type }}
   */
  _pointerPayload(clientX, clientY, buttons, type) {
    const rect = this._target.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const ndcX = rect.width  > 0 ? (x / rect.width)  * 2 - 1 : 0
    const ndcY = rect.height > 0 ? -(y / rect.height) * 2 + 1 : 0
    this._pointerPos = { x, y, ndcX, ndcY }
    return { x, y, ndcX, ndcY, buttons, type }
  }
}

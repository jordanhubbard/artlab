/**
 * artlab/ui
 *
 * CSS2D-based UI overlay helpers for Artlab scenes.
 * Provides attached 3D labels, fixed HUD panels, progress bars, and tooltips.
 *
 * Requires CSS2DRenderer to be set up in the host application alongside the
 * main WebGLRenderer.  Labels are attached via CSS2DObject; HUD elements are
 * plain HTMLElements injected into document.body.
 *
 * @module artlab/ui
 *
 * @example
 *   import { label, hud, progressBar, tooltip } from 'artlab/ui'
 *
 *   // 3D label that follows a mesh
 *   const tag = label(mesh, 'Planet Earth', { color: '#00ff88', offsetY: 1.2 })
 *   tag.setText('Earth (selected)')
 *
 *   // Fixed overlay
 *   const panel = hud({ position: 'top-left' })
 *   panel.setText('FPS: 60')
 *
 *   // Progress bar
 *   const bar = progressBar({ width: 200, label: 'Loading…' })
 *   bar.setValue(0.75)
 *
 *   // Mouse tooltip
 *   const tip = tooltip()
 *   tip.show('Click to interact', event.clientX, event.clientY)
 */

import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// label
// ---------------------------------------------------------------------------

/**
 * Attach a CSS2D text label to a Three.js object.
 *
 * The label follows the object in 3D space and is rendered on top via
 * CSS2DRenderer.  The returned handle lets you update text and opacity or
 * detach the label entirely.
 *
 * @param {THREE.Object3D} obj         Object to attach the label to
 * @param {string}         text        Initial label text
 * @param {object}         [options]
 * @param {string}  [options.color='#ffffff']        CSS colour of the text
 * @param {string}  [options.fontSize='14px']        CSS font-size
 * @param {string}  [options.fontFamily='sans-serif'] CSS font-family
 * @param {number}  [options.offsetY=0]              Y offset in scene units above the object origin
 * @param {string}  [options.letterSpacing='normal'] CSS letter-spacing
 * @returns {{
 *   label: CSS2DObject,
 *   setText(s: string): void,
 *   setOpacity(v: number): void,
 *   detach(): void,
 * }}
 *
 * @example
 *   const tag = label(planetMesh, 'Mars', { color: '#ff4444', offsetY: 1.5 })
 *   // later:
 *   tag.setText('Mars (hover)')
 *   tag.setOpacity(0.5)
 *   tag.detach()
 */
export function label(obj, text, options = {}) {
  const {
    color         = '#ffffff',
    fontSize      = '14px',
    fontFamily    = 'sans-serif',
    offsetY       = 0,
    letterSpacing = 'normal',
  } = options

  const el = document.createElement('div')
  el.textContent = text
  _applyLabelStyles(el, { color, fontSize, fontFamily, letterSpacing })

  const cssObj = new CSS2DObject(el)
  cssObj.position.set(0, offsetY, 0)

  obj.add(cssObj)

  return {
    /** The underlying CSS2DObject — attach to a different parent if needed. */
    label: cssObj,

    /**
     * Update the displayed text.
     * @param {string} s
     */
    setText(s) {
      el.textContent = s
    },

    /**
     * Set the overall opacity of the label (0 = invisible, 1 = fully visible).
     * @param {number} v  Value between 0 and 1
     */
    setOpacity(v) {
      el.style.opacity = String(Math.max(0, Math.min(1, v)))
    },

    /**
     * Remove the label from its parent object and clean up the DOM element.
     */
    detach() {
      obj.remove(cssObj)
      if (el.parentNode) el.parentNode.removeChild(el)
    },
  }
}

// ---------------------------------------------------------------------------
// hud
// ---------------------------------------------------------------------------

/**
 * Create a fixed-position HUD overlay panel.
 *
 * The panel is a `<div>` injected into `document.body` with absolute
 * positioning so it always appears on screen regardless of the camera.
 *
 * @param {object} [options]
 * @param {'top-left'|'top-right'|'bottom-left'|'bottom-right'|'center'} [options.position='top-left']
 * @param {string} [options.padding='8px 12px']  CSS padding
 * @param {string} [options.color='#ffffff']     Text colour
 * @param {string} [options.background='rgba(0,0,0,0.5)'] Background colour
 * @param {string} [options.fontSize='13px']     CSS font-size
 * @param {string} [options.fontFamily='monospace'] CSS font-family
 * @returns {{
 *   el: HTMLElement,
 *   setText(s: string): void,
 *   setHTML(s: string): void,
 *   show(): void,
 *   hide(): void,
 *   dispose(): void,
 * }}
 *
 * @example
 *   const overlay = hud({ position: 'top-right' })
 *   overlay.setText('FPS: 60')
 *   // later:
 *   overlay.dispose()
 */
export function hud(options = {}) {
  const {
    position   = 'top-left',
    padding    = '8px 12px',
    color      = '#ffffff',
    background = 'rgba(0,0,0,0.5)',
    fontSize   = '13px',
    fontFamily = 'monospace',
  } = options

  const el = document.createElement('div')
  Object.assign(el.style, {
    position:   'fixed',
    zIndex:     '1000',
    padding,
    color,
    background,
    fontSize,
    fontFamily,
    pointerEvents: 'none',
    borderRadius: '4px',
    ..._positionStyles(position),
  })

  document.body.appendChild(el)

  return {
    /** The raw HTMLElement — style or reparent as needed. */
    el,

    /**
     * Set the panel text content (HTML-escaped).
     * @param {string} s
     */
    setText(s) { el.textContent = s },

    /**
     * Set the panel inner HTML directly.
     * @param {string} s
     */
    setHTML(s) { el.innerHTML = s },

    /** Make the panel visible (reverses hide()). */
    show() { el.style.display = '' },

    /** Hide the panel without removing it from the DOM. */
    hide() { el.style.display = 'none' },

    /**
     * Remove the panel from the DOM.
     */
    dispose() {
      if (el.parentNode) el.parentNode.removeChild(el)
    },
  }
}

// ---------------------------------------------------------------------------
// progressBar
// ---------------------------------------------------------------------------

/**
 * Create a HUD progress-bar element.
 *
 * @param {object} [options]
 * @param {number} [options.width=180]                    Bar width in pixels
 * @param {string} [options.color='#00ccff']              Fill colour
 * @param {string} [options.backgroundColor='rgba(255,255,255,0.15)'] Track colour
 * @param {'top-left'|'top-right'|'bottom-left'|'bottom-right'|'center'} [options.position='bottom-left']
 * @param {string} [options.label='']                     Optional label text shown above the bar
 * @returns {{
 *   el: HTMLElement,
 *   setValue(v: number): void,
 *   setLabel(s: string): void,
 *   show(): void,
 *   hide(): void,
 *   dispose(): void,
 * }}
 *
 * @example
 *   const loader = progressBar({ label: 'Loading assets…', width: 240 })
 *   loader.setValue(0.5)
 *   // on complete:
 *   loader.dispose()
 */
export function progressBar(options = {}) {
  const {
    width           = 180,
    color           = '#00ccff',
    backgroundColor = 'rgba(255,255,255,0.15)',
    position        = 'bottom-left',
    label: initLabel = '',
  } = options

  // Outer container
  const el = document.createElement('div')
  Object.assign(el.style, {
    position:    'fixed',
    zIndex:      '1000',
    width:       `${width}px`,
    padding:     '8px 12px',
    background:  'rgba(0,0,0,0.5)',
    borderRadius: '4px',
    pointerEvents: 'none',
    boxSizing:   'border-box',
    ..._positionStyles(position),
  })

  // Label text
  const labelEl = document.createElement('div')
  Object.assign(labelEl.style, {
    color:      '#ffffff',
    fontSize:   '12px',
    fontFamily: 'monospace',
    marginBottom: '4px',
  })
  labelEl.textContent = initLabel
  if (!initLabel) labelEl.style.display = 'none'
  el.appendChild(labelEl)

  // Track
  const track = document.createElement('div')
  Object.assign(track.style, {
    width:        '100%',
    height:       '6px',
    background:   backgroundColor,
    borderRadius: '3px',
    overflow:     'hidden',
  })
  el.appendChild(track)

  // Fill
  const fill = document.createElement('div')
  Object.assign(fill.style, {
    width:        '0%',
    height:       '100%',
    background:   color,
    borderRadius: '3px',
    transition:   'width 0.1s linear',
  })
  track.appendChild(fill)

  document.body.appendChild(el)

  return {
    /** The outer container element. */
    el,

    /**
     * Set the fill level.
     * @param {number} v  Value between 0 and 1
     */
    setValue(v) {
      fill.style.width = `${Math.max(0, Math.min(1, v)) * 100}%`
    },

    /**
     * Update the label text.
     * @param {string} s
     */
    setLabel(s) {
      labelEl.textContent = s
      labelEl.style.display = s ? '' : 'none'
    },

    /** Show the progress bar. */
    show() { el.style.display = '' },

    /** Hide the progress bar without removing it. */
    hide() { el.style.display = 'none' },

    /** Remove the progress bar from the DOM. */
    dispose() {
      if (el.parentNode) el.parentNode.removeChild(el)
    },
  }
}

// ---------------------------------------------------------------------------
// tooltip
// ---------------------------------------------------------------------------

/**
 * Create a mouse-following tooltip element.
 *
 * The tooltip is not attached to any 3D object — it is positioned via
 * `show(text, x, y)` using viewport pixel coordinates (e.g. from MouseEvent).
 *
 * @param {object} [options]
 * @param {string} [options.color='#ffffff']              Text colour
 * @param {string} [options.background='rgba(0,0,0,0.75)'] Background colour
 * @param {string} [options.padding='6px 10px']           CSS padding
 * @param {string} [options.fontSize='13px']              CSS font-size
 * @param {string} [options.fontFamily='sans-serif']      CSS font-family
 * @param {number} [options.offsetX=12]                   Horizontal offset from cursor in px
 * @param {number} [options.offsetY=8]                    Vertical offset from cursor in px
 * @returns {{
 *   el: HTMLElement,
 *   show(text: string, x: number, y: number): void,
 *   hide(): void,
 *   dispose(): void,
 * }}
 *
 * @example
 *   const tip = tooltip({ background: '#222233' })
 *   canvas.addEventListener('mousemove', e => {
 *     tip.show('Drag to rotate', e.clientX, e.clientY)
 *   })
 *   canvas.addEventListener('mouseleave', () => tip.hide())
 */
export function tooltip(options = {}) {
  const {
    color      = '#ffffff',
    background = 'rgba(0,0,0,0.75)',
    padding    = '6px 10px',
    fontSize   = '13px',
    fontFamily = 'sans-serif',
    offsetX    = 12,
    offsetY    = 8,
  } = options

  const el = document.createElement('div')
  Object.assign(el.style, {
    position:      'fixed',
    zIndex:        '2000',
    pointerEvents: 'none',
    display:       'none',
    color,
    background,
    padding,
    fontSize,
    fontFamily,
    borderRadius:  '4px',
    whiteSpace:    'nowrap',
    boxShadow:     '0 2px 6px rgba(0,0,0,0.4)',
  })

  document.body.appendChild(el)

  return {
    /** The tooltip DOM element. */
    el,

    /**
     * Show the tooltip with `text` near the given viewport coordinates.
     *
     * Automatically adjusts to stay within the viewport.
     *
     * @param {string} text  Content to display
     * @param {number} x     Viewport X in pixels (e.g. MouseEvent.clientX)
     * @param {number} y     Viewport Y in pixels (e.g. MouseEvent.clientY)
     */
    show(text, x, y) {
      el.textContent = text
      el.style.display = ''

      // Compute position, clamping to viewport
      const vw = window.innerWidth
      const vh = window.innerHeight
      const rect = el.getBoundingClientRect()
      const tipW = rect.width  || 120
      const tipH = rect.height || 28

      const left = (x + offsetX + tipW > vw) ? x - tipW - offsetX : x + offsetX
      const top  = (y + offsetY + tipH > vh) ? y - tipH - offsetY : y + offsetY

      el.style.left = `${left}px`
      el.style.top  = `${top}px`
    },

    /** Hide the tooltip. */
    hide() {
      el.style.display = 'none'
    },

    /** Remove the tooltip from the DOM. */
    dispose() {
      if (el.parentNode) el.parentNode.removeChild(el)
    },
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Return CSS position styles for a named corner / center position.
 * @private
 */
function _positionStyles(position) {
  switch (position) {
    case 'top-right':    return { top: '12px',    right:  '12px'   }
    case 'bottom-left':  return { bottom: '12px', left:   '12px'   }
    case 'bottom-right': return { bottom: '12px', right:  '12px'   }
    case 'center':       return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
    case 'top-left':
    default:             return { top: '12px',    left:   '12px'   }
  }
}

/**
 * Apply typography / colour styles to a label element.
 * @private
 */
function _applyLabelStyles(el, { color, fontSize, fontFamily, letterSpacing }) {
  Object.assign(el.style, {
    color,
    fontSize,
    fontFamily,
    letterSpacing,
    pointerEvents:  'none',
    userSelect:     'none',
    textShadow:     '0 1px 3px rgba(0,0,0,0.8)',
    whiteSpace:     'nowrap',
  })
}

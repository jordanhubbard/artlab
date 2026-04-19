/**
 * Artlab IDE — barrel re-export and boot entry point.
 *
 * This module is the script entry point for ide.html.
 * It instantiates the IDE controller and calls init().
 */

export { IDE }         from './IDE.js'
export { PreviewPane } from './PreviewPane.js'
export * from './panels/index.js'

import { IDE } from './IDE.js'

// Boot
const ide = new IDE()
ide.init().catch(err => {
  console.error('[Artlab IDE] Fatal init error:', err)
  const el = document.getElementById('monaco-loading')
  if (el) {
    el.style.color = '#ff6b6b'
    el.textContent = 'IDE init failed: ' + err.message
  }
})

// Expose globally for debugging
window.__artlabIDE = ide

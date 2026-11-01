import type { IDE } from './IDE.ts'
import type { Environment } from 'monaco-editor/esm/vs/editor/editor.api.js'

declare global {
  var MonacoEnvironment: Environment | undefined
  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>
  }
  interface Window {
    showDirectoryPicker?(options: { mode: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
    __artlabIDE?: IDE
  }
  interface Document {
    readonly webkitFullscreenElement?: Element | null
    webkitExitFullscreen?(): void
  }
  interface HTMLElement { webkitRequestFullscreen?(): void }
}

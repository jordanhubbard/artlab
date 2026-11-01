/** Start audio/media from a gesture, with retry and disposal during async startup. */
export class GestureButton {
  private disposed = false
  readonly button: HTMLButtonElement
  private readonly _click: () => Promise<void>
  constructor(parent: Node, { label, start, pending = 'Starting…', onError = console.error }: {
    label: string
    start(): unknown | Promise<unknown>
    pending?: string
    onError?(error: unknown): void
  }) {
    this.disposed = false
    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.textContent = label
    this.button.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100;padding:14px 32px;background:#101827;color:#dceaff;border:1px solid #6287ba;border-radius:4px;font:13px monospace;cursor:pointer'
    this._click = async () => {
      if (this.disposed || this.button.disabled) return
      this.button.disabled = true
      this.button.textContent = pending
      try {
        await start()
        this.button.remove()
      } catch (error) {
        if (this.disposed) return
        this.button.disabled = false
        this.button.textContent = `${label} — retry`
        this.button.title = error instanceof Error ? error.message : String(error)
        onError(error)
      }
    }
    this.button.addEventListener('click', this._click)
    parent.appendChild(this.button)
  }

  dispose() {
    this.disposed = true
    this.button.removeEventListener('click', this._click)
    this.button.remove()
  }
}

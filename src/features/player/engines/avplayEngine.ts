import type { PlaybackEngine } from '../types/player'

let activeInstance: AvplayPlaybackEngine | null = null

/**
 * Motor Samsung AVPlay (`window.webapis.avplay`).
 * Uma instância ativa de cada vez; `open`/`destroy` fecham sessões anteriores.
 */
export class AvplayPlaybackEngine implements PlaybackEngine {
  readonly kind = 'avplay' as const

  private static assignActive(instance: AvplayPlaybackEngine): void {
    activeInstance = instance
  }

  private static clearActiveIf(instance: AvplayPlaybackEngine): void {
    if (activeInstance === instance) activeInstance = null
  }

  private container: HTMLElement | null = null
  private destroyed = false
  private currentUrl: string | null = null
  /** Após `prepareAsync` + primeiro `play`, usa-se `play()` directo para retomar. */
  private prepared = false

  attachDisplay(container: HTMLElement): void {
    this.container = container
  }

  init(): void {
    const av = window.webapis?.avplay
    if (!av) {
      throw new Error('AVPlay não disponível neste ambiente.')
    }
    if (activeInstance && activeInstance !== this) {
      void activeInstance.stopInternal()
      activeInstance.closeInternal()
      activeInstance = null
    }
    AvplayPlaybackEngine.assignActive(this)
  }

  open(url: string): void {
    this.ensureAv()
    if (this.destroyed) return
    const av = window.webapis!.avplay!

    try {
      av.stop()
    } catch {
      /* já parado */
    }
    try {
      av.close()
    } catch {
      /* já fechado */
    }

    av.open(url)
    this.currentUrl = url
    this.prepared = false
    this.syncDisplayRect()
  }

  private prepareAndPlay(): Promise<void> {
    return new Promise((resolve, reject) => {
      const av = window.webapis?.avplay
      if (!av || this.destroyed) {
        reject(new Error('AVPlay indisponível ou destruído.'))
        return
      }
      av.prepareAsync(
        () => {
          try {
            av.play()
            this.prepared = true
            resolve()
          } catch (e) {
            reject(e)
          }
        },
        (err) => {
          reject(err instanceof Error ? err : new Error(String(err)))
        },
      )
    })
  }

  async play(): Promise<void> {
    this.ensureAv()
    if (!this.currentUrl) {
      throw new Error('Nenhuma URL aberta.')
    }
    const av = window.webapis!.avplay!
    if (this.prepared) {
      try {
        av.play()
      } catch {
        await this.prepareAndPlay()
      }
      return
    }
    await this.prepareAndPlay()
  }

  pause(): void {
    try {
      window.webapis?.avplay?.pause()
    } catch {
      /* ignore */
    }
  }

  async stop(): Promise<void> {
    await this.stopInternal()
  }

  private async stopInternal(): Promise<void> {
    try {
      window.webapis?.avplay?.stop()
    } catch {
      /* ignore */
    }
    this.prepared = false
    this.currentUrl = null
  }

  setFullscreen(): void {
    /** Integração futura: `tizen.application` / APIs de ecrã; placeholder. */
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return
    this.destroyed = true
    this.prepared = false
    await this.stopInternal()
    try {
      window.webapis?.avplay?.close()
    } catch {
      /* ignore */
    }
    AvplayPlaybackEngine.clearActiveIf(this)
    this.container = null
    this.currentUrl = null
  }

  private closeInternal(): void {
    try {
      window.webapis?.avplay?.close()
    } catch {
      /* ignore */
    }
    this.prepared = false
    this.currentUrl = null
  }

  private ensureAv(): void {
    if (!window.webapis?.avplay) {
      throw new Error('webapis.avplay não encontrado.')
    }
  }

  private syncDisplayRect(): void {
    const av = window.webapis?.avplay
    const el = this.container
    if (!av || !el || this.destroyed) return
    const r = el.getBoundingClientRect()
    const x = Math.floor(r.left)
    const y = Math.floor(r.top)
    const w = Math.floor(r.width)
    const h = Math.floor(r.height)
    if (w <= 0 || h <= 0) return
    try {
      av.setDisplayRect(x, y, w, h)
    } catch {
      /* alguns perfis exigem chamada após prepare */
    }
  }
}

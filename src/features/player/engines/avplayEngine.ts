import type { PlaybackEngine } from '../types/player'

let activeInstance: AvplayPlaybackEngine | null = null

/**
 * Motor Samsung AVPlay (`window.webapis.avplay`).
 *
 * Usa `<object type="application/avplayer">` como superfície de renderização —
 * o método mais fiável em todas as versões de firmware Tizen (5.x → 8.x).
 * O elemento object renderiza inline no fluxo HTML, portanto backgrounds opacos
 * em ancestrais não bloqueiam o vídeo (ao contrário do modo overlay nativo, que
 * requer body transparente ou PLAYER_DISPLAY_TYPE_OVERLAY disponível).
 *
 * Uma instância ativa de cada vez; `destroy` fecha sessões anteriores.
 */
export class AvplayPlaybackEngine implements PlaybackEngine {
  readonly kind = 'avplay' as const

  private static assignActive(instance: AvplayPlaybackEngine): void {
    activeInstance = instance
  }

  private static clearActiveIf(instance: AvplayPlaybackEngine): void {
    if (activeInstance === instance) activeInstance = null
  }

  /** Elemento <object> que serve de superfície de renderização do AVPlay. */
  private avplayObject: HTMLObjectElement | null = null
  private destroyed = false
  private currentUrl: string | null = null
  /** Após `prepareAsync` + primeiro `play`, usa-se `play()` directo para retomar. */
  private prepared = false

  attachDisplay(container: HTMLElement): void {
    // Criar <object type="application/avplayer"> como surface de renderização.
    // O AVPlay liga-se automaticamente a este elemento; não é necessário setDisplayRect.
    // O elemento preenche o container via CSS absolute, tal como faria um <video>.
    const obj = document.createElement('object')
    obj.type = 'application/avplayer'
    obj.style.cssText =
      'display:block;position:absolute;inset:0;width:100%;height:100%;'
    this.avplayObject = obj
    container.appendChild(obj)
  }

  /** Live HLS: listener de buffering para sincronizar estado da UI. */
  private wireAvPlayListener(): void {
    const av = window.webapis?.avplay
    if (!av || typeof av.setListener !== 'function') return
    try {
      av.setListener({
        onbufferingstart: () => { /* state tracking is done by the controller */ },
        onbufferingcomplete: () => { /* idem */ },
      })
    } catch {
      /* ignore */
    }
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

    try { av.stop?.() } catch { /* já parado */ }
    try { av.close?.() } catch { /* já fechado */ }

    av.open(url)
    // setDisplayMethod controla o modo de ajuste do vídeo ao element object.
    // Não chamar setDisplayType nem setDisplayRect: o <object> gere o rect.
    try {
      av.setDisplayMethod?.('PLAYER_DISPLAY_MODE_LETTER_BOX')
    } catch {
      /* perfis antigos */
    }
    this.wireAvPlayListener()
    this.currentUrl = url
    this.prepared = false
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
      window.webapis?.avplay?.stop?.()
    } catch {
      /* ignore */
    }
    this.prepared = false
    this.currentUrl = null
  }

  setFullscreen(): void {
    /** Integração futura: `tizen.application` / APIs de ecrã; placeholder. */
  }

  enterFullscreenDisplay(): void {
    if (this.destroyed || !this.avplayObject) return
    const obj = this.avplayObject
    obj.style.cssText =
      'display:block;position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:10000;'
  }

  exitFullscreenDisplay(): void {
    if (this.destroyed || !this.avplayObject) return
    const obj = this.avplayObject
    obj.style.cssText =
      'display:block;position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;'
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return
    this.destroyed = true
    this.prepared = false

    // Remover o elemento <object> de forma síncrona ANTES do await,
    // para que o novo engine (que corre imediatamente após o cleanup)
    // não encontre dois <object> no container ao chamar attachDisplay.
    this.avplayObject?.remove()
    this.avplayObject = null

    await this.stopInternal()

    // Guarda: só fechar o AVPlay se este engine ainda for a instância activa.
    // O cleanup do useLayoutEffect chama `void engine.destroy()` sem await;
    // o novo engine pode já ter chamado open() antes deste microtask continuar.
    // Chamar close() nesse caso mataria o novo stream.
    if (activeInstance === this) {
      try {
        window.webapis?.avplay?.close()
      } catch {
        /* ignore */
      }
    }
    AvplayPlaybackEngine.clearActiveIf(this)
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
}

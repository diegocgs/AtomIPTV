import Hls from 'hls.js'
import { isSamsungTizenLikeRuntime } from '@/lib/tvFocus/tvRemoteKeys'
import { isAutoplayPolicyError } from '../autoplayPolicy'
import type { PlaybackEngine } from '../types/player'

function isHlsUrl(url: string): boolean {
  const u = url.trim().toLowerCase()
  return u.includes('.m3u8') || u.includes('/hlsr/') || u.includes('application/vnd.apple.mpegurl')
}

/**
 * Alguns painéis IPTV devolvem 403 aos segmentos .ts se faltar Referer / User-Agent
 * típicos de browser; o elemento <video> não permite definir isso. O hls.js usa XHR e
 * permite cabeçalhos por pedido.
 */
function createHlsWithIptvHeaders(): Hls {
  return new Hls({
    enableWorker: true,
    xhrSetup(xhr, requestUrl) {
      try {
        const parsed = new URL(requestUrl)
        xhr.setRequestHeader('Referer', `${parsed.origin}/`)
        xhr.setRequestHeader(
          'User-Agent',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        )
      } catch {
        /* ignore */
      }
    },
  })
}

/**
 * Motor HTML5 `<video>`.
 *
 * No Tizen Samsung, o `<video>` é colocado directamente no `<body>` com
 * `position: fixed` e coordenadas calculadas a partir do container original.
 * Isto evita que `overflow:hidden`, `border-radius`, `backdrop-filter` e
 * outras propriedades CSS em ancestrais impeçam a renderização de frames
 * (bug do compositing no Tizen WebKit ≤Chrome 76).
 * No browser de desenvolvimento, o `<video>` é filho directo do container.
 */
export class Html5PlaybackEngine implements PlaybackEngine {
  readonly kind = 'html5' as const

  private container: HTMLElement | null = null
  private video: HTMLVideoElement | null = null
  private hls: Hls | null = null
  private destroyed = false
  /** Após fallback muted (política de autoplay), reativa som no primeiro gesto. */
  private unmuteGestureAttached = false
  private rectRafId: number | null = null
  private resizeObserver: ResizeObserver | null = null
  private isFullscreenDisplay = false
  /** On Tizen, the <video> is detached from the container (body-fixed). */
  private isDetached = false

  attachDisplay(container: HTMLElement): void {
    this.container = container
  }

  init(): void {
    if (this.destroyed) return
    if (!this.container) {
      throw new Error('Html5PlaybackEngine: container em falta — chame attachDisplay antes de init.')
    }
    const v = document.createElement('video')
    v.setAttribute('playsinline', '')
    v.setAttribute('webkit-playsinline', '')
    v.playsInline = true
    v.controls = false
    v.autoplay = false
    v.preload = 'auto'
    v.className = 'html5-engine-video'
    v.style.objectFit = 'contain'
    v.style.background = '#000'

    // No Tizen, overflow:hidden + border-radius em ancestrais impedem o WebKit
    // de renderizar frames de <video> (áudio ok, vídeo preto).
    // Solução: montar o <video> no body com position:fixed sobre o container.
    // EXCEPTO no fullscreen (.player-page, z-index:150): aí o container não
    // tem os CSS problemáticos e o vídeo dentro do container já funciona.
    const isFullscreen = !!this.container.closest('.player-page')
    const needsDetach = isSamsungTizenLikeRuntime() && !isFullscreen

    if (needsDetach) {
      this.isDetached = true
      v.style.position = 'fixed'
      v.style.margin = '0'
      v.style.padding = '0'
      v.style.border = 'none'
      v.style.pointerEvents = 'none'
      document.body.appendChild(v)

      this.syncVideoRect()
      this.startRectSync()
    } else {
      v.style.width = '100%'
      v.style.height = '100%'
      this.container.appendChild(v)

    }

    this.video = v
  }

  /** Sincroniza posição/tamanho do <video> fixo com o bounding rect do container. */
  private syncVideoRect(): void {
    if (!this.video || !this.container || this.destroyed) return
    if (this.isFullscreenDisplay) return
    const r = this.container.getBoundingClientRect()
    const v = this.video
    v.style.left = `${Math.round(r.left)}px`
    v.style.top = `${Math.round(r.top)}px`
    v.style.width = `${Math.round(r.width)}px`
    v.style.height = `${Math.round(r.height)}px`
  }

  /** Inicia polling leve de posição (RAF) + ResizeObserver para manter rect sincronizado. */
  private startRectSync(): void {
    // ResizeObserver para mudanças de tamanho do container
    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this.resizeObserver = new ResizeObserver(() => this.syncVideoRect())
      this.resizeObserver.observe(this.container)
    }
    // RAF polling para mudanças de scroll/layout não captadas pelo ResizeObserver.
    // Na TV o layout é estático, por isso paramos após estabilizar (~2 s).
    let frames = 0
    const maxFrames = 120 // ~2 s a 60 fps
    const tick = () => {
      if (this.destroyed || frames >= maxFrames) {
        this.rectRafId = null
        return
      }
      frames++
      this.syncVideoRect()
      this.rectRafId = requestAnimationFrame(tick)
    }
    this.rectRafId = requestAnimationFrame(tick)
  }

  private stopRectSync(): void {
    if (this.rectRafId != null) {
      cancelAnimationFrame(this.rectRafId)
      this.rectRafId = null
    }
    try { this.resizeObserver?.disconnect() } catch { /* ignore */ }
    this.resizeObserver = null
  }

  private clearSources(): void {
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
    if (this.video) {
      this.video.removeAttribute('src')
      this.video.load()
    }
  }

  open(url: string): void {
    if (this.destroyed || !this.video) return
    const video = this.video
    this.clearSources()
    const isTizen = isSamsungTizenLikeRuntime()

    if (!isHlsUrl(url)) {
      video.src = url
      void video.load()
      return
    }

    if (isTizen) {
      video.src = url
      void video.load()
      return
    }

    if (Hls.isSupported()) {
      const hls = createHlsWithIptvHeaders()
      this.hls = hls
      hls.loadSource(url)
      hls.attachMedia(video)
      return
    }

    if (
      video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
      video.canPlayType('application/x-mpegURL') !== ''
    ) {
      video.src = url
      void video.load()
      return
    }

    video.src = url
    void video.load()
  }

  private attachUnmuteOnFirstUserGesture(): void {
    if (this.unmuteGestureAttached || this.destroyed) return
    this.unmuteGestureAttached = true
    const once = (): void => {
      if (this.destroyed || !this.video) return
      this.video.muted = false
      void this.video.play().catch(() => {
        /* gesto já permitiu autoplay; falha rara — ignorar */
      })
    }
    window.addEventListener('pointerdown', once, { once: true, capture: true })
    window.addEventListener('keydown', once, { once: true, capture: true })
  }

  play(): Promise<void> {
    if (this.destroyed || !this.video) return Promise.resolve()
    const video = this.video
    const playMuted = (): Promise<void> => {
      video.muted = true
      return video.play().catch((e) => {
        throw e instanceof Error ? e : new Error(String(e))
      })
    }
    return video.play().catch((err: unknown) => {
      if (isAutoplayPolicyError(err) && !video.muted) {
        return playMuted().then(() => {
          this.attachUnmuteOnFirstUserGesture()
        })
      }
      throw err instanceof Error ? err : new Error(String(err))
    })
  }

  pause(): void {
    if (!this.video || this.destroyed) return
    this.video.pause()
  }

  stop(): void {
    if (!this.video || this.destroyed) return
    this.video.pause()
    this.clearSources()
  }

  enterFullscreenDisplay(): void {
    if (this.destroyed || !this.video) return
    this.isFullscreenDisplay = true
    const v = this.video

    if (this.isDetached) {
      // Tizen: <video> já está no body com position:fixed — reposicionar para fullscreen
      v.style.left = '0px'
      v.style.top = '0px'
      v.style.width = '100vw'
      v.style.height = '100vh'
      v.style.zIndex = '10000'
    } else {
      // Browser: <video> dentro do container — tornar fixed fullscreen
      v.style.position = 'fixed'
      v.style.left = '0px'
      v.style.top = '0px'
      v.style.width = '100vw'
      v.style.height = '100vh'
      v.style.zIndex = '10000'
    }
  }

  exitFullscreenDisplay(): void {
    if (this.destroyed || !this.video) return
    this.isFullscreenDisplay = false
    const v = this.video

    if (this.isDetached) {
      // Tizen: restaurar para posição do container
      v.style.zIndex = ''
      this.syncVideoRect()
      this.startRectSync()
    } else {
      // Browser: restaurar inline no container
      v.style.position = ''
      v.style.left = ''
      v.style.top = ''
      v.style.width = '100%'
      v.style.height = '100%'
      v.style.zIndex = ''
    }
  }

  setFullscreen(enabled: boolean): void {
    const el = this.video ?? this.container
    if (!el || this.destroyed) return
    if (!document.fullscreenEnabled) return
    if (enabled) {
      void el.requestFullscreen?.().catch(() => {
        /* silencioso — TV pode restringir */
      })
    } else if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {})
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.unmuteGestureAttached = false
    this.stopRectSync()
    this.clearSources()
    if (this.video) {
      this.video.pause()
      this.video.remove()
      this.video = null
    }
    this.container = null
  }
}

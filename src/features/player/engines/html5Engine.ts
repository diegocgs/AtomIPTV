import Hls from 'hls.js'
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
 * Motor de desenvolvimento / fallback: `<video>` no browser.
 * HLS (.m3u8): Safari usa nativo quando possível; noutros browsers usa hls.js.
 */
export class Html5PlaybackEngine implements PlaybackEngine {
  readonly kind = 'html5' as const

  private container: HTMLElement | null = null
  private video: HTMLVideoElement | null = null
  private hls: Hls | null = null
  private destroyed = false

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
    v.style.width = '100%'
    v.style.height = '100%'
    v.style.objectFit = 'contain'
    v.style.background = '#000'
    this.container.appendChild(v)
    this.video = v
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

    if (!isHlsUrl(url)) {
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

  play(): Promise<void> {
    if (this.destroyed || !this.video) return Promise.resolve()
    return this.video.play().catch((e) => {
      throw e instanceof Error ? e : new Error(String(e))
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
    this.clearSources()
    if (this.video) {
      this.video.pause()
      this.video.remove()
      this.video = null
    }
    this.container = null
  }
}

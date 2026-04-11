export type PlaybackEngineKind = 'avplay' | 'html5'

/** Estado exposto à UI (leitor). */
export type PlayerControllerState = {
  engineKind: PlaybackEngineKind
  isPlaying: boolean
  isBuffering: boolean
  error: string | null
  durationMs: number | null
  currentTimeMs: number | null
}

/** Dados passados ao navegar para `/player` (history state). */
export type PlayerNavigationState = {
  streamUrl: string
  title?: string
  channelId?: string
  returnTo?: string
  /** Metadados livres para analytics / futuro */
  contentType?: string
}

/** Contrato comum a AVPlay e HTML5 — sem dependências de React. */
export interface PlaybackEngine {
  readonly kind: PlaybackEngineKind

  /** Liga o motor ao DOM (HTML5) ou ao rect de vídeo (AVPlay). */
  attachDisplay(container: HTMLElement): void

  init(): void

  /** Abre nova fonte; implementações devem fechar sessão anterior de forma segura. */
  open(url: string): void | Promise<void>

  play(): void | Promise<void>
  pause(): void | Promise<void>
  stop(): void | Promise<void>

  /** Ecrã completo: AVPlay/Tizen pode usar API nativa; HTML5 pode usar Fullscreen API. */
  setFullscreen(enabled?: boolean): void | Promise<void>

  /**
   * Reposiciona o elemento de vídeo para cobrir todo o viewport (fullscreen CSS-only).
   * Mantém a mesma instância — sem reconexão do stream.
   */
  enterFullscreenDisplay(): void

  /**
   * Restaura o elemento de vídeo para a posição original dentro do container de preview.
   */
  exitFullscreenDisplay(): void

  destroy(): void | Promise<void>
}

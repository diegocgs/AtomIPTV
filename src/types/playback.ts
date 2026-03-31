/**
 * Contratos para integração futura com player nativo (ex.: Samsung AVPlay).
 * Fase 1: apenas tipos e placeholder — sem playback real.
 */

export type PlaybackEngineId = 'avplay' | 'html5' | 'placeholder'

export interface PlaybackSource {
  /** URL ou identificador interno; em produção virá do backend. */
  uri: string
  contentType?: string
  title?: string
}

export interface PlaybackSession {
  id: string
  engine: PlaybackEngineId
  source: PlaybackSource
  startedAtMs: number
}

export interface PlaybackCapabilities {
  supportsHls: boolean
  supportsDash: boolean
  drm?: ('widevine' | 'playready')[]
}

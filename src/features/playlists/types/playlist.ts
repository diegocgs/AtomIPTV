/** Discriminador de fonte (M3U URL vs painel Xtream). */
export type PlaylistType = 'm3u' | 'xtream'

/**
 * Ciclo de vida da playlist no cliente.
 * `validating` fica reservado para fases futuras (rede, parse).
 */
export type PlaylistStatus = 'idle' | 'validating' | 'ready' | 'error'

export interface M3UPlaylistConfig {
  url: string
}

export interface XtreamPlaylistConfig {
  /** URL base normalizada (ex.: https://host:8080) */
  server: string
  username: string
  password: string
  port?: number
  useHttps?: boolean
}

/** Snapshot normalizado para consumo futuro (catálogo, player). */
export type PlaylistResolution =
  | {
      kind: 'm3u'
      playlistUrl: string
      displayUrl: string
    }
  | {
      kind: 'xtream'
      apiBaseUrl: string
      displayUrl: string
      username: string
      useHttps: boolean
      port?: number
    }

interface PlaylistEntityBase {
  id: string
  name: string
  isActive: boolean
  createdAt: number
  updatedAt: number
  lastValidatedAt?: number
  status: PlaylistStatus
  errorMessage?: string
  resolution?: PlaylistResolution
}

export type PlaylistEntity =
  | (PlaylistEntityBase & { type: 'm3u'; m3u: M3UPlaylistConfig })
  | (PlaylistEntityBase & { type: 'xtream'; xtream: XtreamPlaylistConfig })

export function isM3UPlaylist(p: PlaylistEntity): p is PlaylistEntity & { type: 'm3u'; m3u: M3UPlaylistConfig } {
  return p.type === 'm3u'
}

export function isXtreamPlaylist(
  p: PlaylistEntity,
): p is PlaylistEntity & { type: 'xtream'; xtream: XtreamPlaylistConfig } {
  return p.type === 'xtream'
}

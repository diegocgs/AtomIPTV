/** Origem técnica do item (persistência / debug). */
export type LiveSourceType = 'm3u' | 'xtream'

/** Catálogo unificado para a UI Live TV. */
export type LiveCategory = {
  id: string
  name: string
  order: number
}

export type LiveChannel = {
  id: string
  name: string
  /** URL do logo; pode ser vazio. */
  logo: string
  categoryId: string
  streamUrl: string
  streamFormat?: string
  sourceType: LiveSourceType
  /** id nativo (ex.: stream_id Xtream, índice M3U). */
  originalSourceId?: string
  epgChannelId?: string
  isLive: true
  number?: number
}

export type LiveCatalogSourceKind = 'm3u' | 'xtream' | 'none'

export type LiveCatalogResult = {
  categories: LiveCategory[]
  channels: LiveChannel[]
  /** Tipo da playlist que originou o catálogo. */
  sourceType: LiveCatalogSourceKind
  loadedAt: number
  /** Metadados opcionais (nome da playlist, etc.). */
  meta?: {
    playlistName?: string
    playlistId?: string
  }
}

export type LiveCatalogEmptyReason =
  | 'no_active_playlist'
  | 'fetch_failed'
  | 'parse_failed'
  | 'xtream_api_failed'
  | 'no_channels'

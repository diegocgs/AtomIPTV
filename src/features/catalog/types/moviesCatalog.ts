import type { XtreamVodCategory, XtreamVodStream } from '@/services/xtream'

export type MoviesCatalogSourceKind = 'm3u' | 'xtream' | 'none'

export type MoviesCatalogResult = {
  categories: XtreamVodCategory[]
  streams: XtreamVodStream[]
  /** Só listas M3U “seca”: `stream_id` → URL real (playback). */
  m3uStreamUrls?: Record<string, string>
  sourceType: MoviesCatalogSourceKind
  loadedAt: number
  meta?: {
    playlistName?: string
    playlistId?: string
  }
}

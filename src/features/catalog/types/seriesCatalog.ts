import type { XtreamSeriesCategory, XtreamSeriesStream } from '@/services/xtream'

export type SeriesCatalogSourceKind = 'm3u' | 'xtream' | 'none'

export type SeriesCatalogResult = {
  categories: XtreamSeriesCategory[]
  series: XtreamSeriesStream[]
  /** Só listas M3U “seca”: `series_id` → URL da lista (episódio ou série). */
  m3uSeriesUrls?: Record<string, string>
  sourceType: SeriesCatalogSourceKind
  loadedAt: number
  meta?: {
    playlistName?: string
    playlistId?: string
  }
}

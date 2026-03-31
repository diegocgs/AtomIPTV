export type CatalogItemType = 'channel' | 'movie' | 'series' | 'episode'

export interface LiveCategory {
  id: string
  name: string
  order: number
}

export interface Channel {
  id: string
  name: string
  logoUrl: string
  categoryId: string
  type: 'channel'
  description: string
  number?: number
}

export interface MovieCategory {
  id: string
  name: string
  order: number
}

export interface Movie {
  id: string
  title: string
  posterUrl: string
  categoryId: string
  type: 'movie'
  description: string
  durationMin: number
  year: number
  badge?: string
}

export interface SeriesCategory {
  id: string
  name: string
  order: number
}

export interface SeriesShow {
  id: string
  title: string
  posterUrl: string
  categoryId: string
  type: 'series'
  description: string
  year: number
  seasons: number
}

export interface Episode {
  id: string
  seriesId: string
  title: string
  season: number
  number: number
  thumbnailUrl: string
  durationMin: number
  type: 'episode'
}

export interface ContinueWatchingItem {
  id: string
  title: string
  posterUrl: string
  type: CatalogItemType
  refId: string
  progressPct: number
  durationMin?: number
}

export type DetailRouteType = 'channel' | 'movie' | 'series'

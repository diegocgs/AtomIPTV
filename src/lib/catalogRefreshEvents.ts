import type { LiveCatalogResult } from '@/features/catalog/types/liveCatalog'
import type { MoviesCatalogResult } from '@/features/catalog/types/moviesCatalog'
import type { SeriesCatalogResult } from '@/features/catalog/types/seriesCatalog'

export const CATALOG_REFRESH_EVENT = 'iptv-catalog-refresh'

export type CatalogRefreshDetail =
  | { kind: 'live'; playlistId: string; result: LiveCatalogResult }
  | { kind: 'movies'; playlistId: string; result: MoviesCatalogResult }
  | { kind: 'series'; playlistId: string; result: SeriesCatalogResult }

export function dispatchCatalogRefresh(detail: CatalogRefreshDetail): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(CATALOG_REFRESH_EVENT, { detail }))
  } catch {
    /* ignore */
  }
}

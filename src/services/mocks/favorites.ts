import type { CatalogItemType } from '@/types/catalog'

/** IDs de itens favoritos (referenciam mocks de canal/filme/série). */
export const mockFavoriteRefs: { refId: string; type: CatalogItemType }[] = [
  { refId: 'mv-paper', type: 'movie' },
  { refId: 'sr-signal', type: 'series' },
  { refId: 'ch-hbo', type: 'channel' },
  { refId: 'mv-orbit', type: 'movie' },
]

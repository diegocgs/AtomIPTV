import type { Channel, Movie, SeriesShow } from '@/types/catalog'
import {
  mockChannels,
  mockEpisodes,
  mockFavoriteRefs,
  mockMovies,
  mockSeries,
} from '@/services/mocks'

export type CatalogUnion = Channel | Movie | SeriesShow

export function getChannelById(id: string): Channel | undefined {
  return mockChannels.find((c) => c.id === id)
}

export function getMovieById(id: string): Movie | undefined {
  return mockMovies.find((m) => m.id === id)
}

export function getSeriesById(id: string): SeriesShow | undefined {
  return mockSeries.find((s) => s.id === id)
}

export function getItemByTypeAndId(
  type: 'channel' | 'movie' | 'series',
  id: string,
): CatalogUnion | undefined {
  if (type === 'channel') return getChannelById(id)
  if (type === 'movie') return getMovieById(id)
  return getSeriesById(id)
}

export function getEpisodesForSeries(seriesId: string) {
  return mockEpisodes.filter((e) => e.seriesId === seriesId)
}

export function getFavoriteItems(): CatalogUnion[] {
  const out: CatalogUnion[] = []
  for (const ref of mockFavoriteRefs) {
    const item = getItemByTypeAndId(
      ref.type === 'channel' ? 'channel' : ref.type === 'movie' ? 'movie' : 'series',
      ref.refId,
    )
    if (item) out.push(item)
  }
  return out
}

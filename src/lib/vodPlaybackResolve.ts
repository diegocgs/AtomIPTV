import { getXtreamCredentialsForApp, shouldUseXtreamApiForActivePlaylist } from '@/lib/playlistsStorage'
import type { MoviesCatalogSourceKind } from '@/features/catalog/types/moviesCatalog'
import type { SeriesCatalogSourceKind } from '@/features/catalog/types/seriesCatalog'
import {
  buildXtreamSeriesStreamUrl,
  buildXtreamVodStreamUrl,
  fetchXtreamSeriesEpisodes,
  type XtreamSeriesStream,
  type XtreamVodStream,
} from '@/services/xtream'

export function resolveMoviePlayUrl(
  stream: XtreamVodStream,
  sourceType: MoviesCatalogSourceKind,
  m3uStreamUrls?: Record<string, string>
): string | null {
  if (sourceType === 'm3u' && m3uStreamUrls) {
    const u = m3uStreamUrls[String(stream.stream_id)]
    return u?.trim() ? u : null
  }
  if (!shouldUseXtreamApiForActivePlaylist()) return null
  const creds = getXtreamCredentialsForApp()
  const ext = stream.container_extension?.replace(/^\./, '') || 'mp4'
  try {
    return buildXtreamVodStreamUrl(creds, stream.stream_id, ext)
  } catch {
    return null
  }
}

export async function resolveSeriesPlayUrl(
  series: XtreamSeriesStream,
  sourceType: SeriesCatalogSourceKind,
  m3uSeriesUrls?: Record<string, string>
): Promise<string | null> {
  if (sourceType === 'm3u' && m3uSeriesUrls) {
    const u = m3uSeriesUrls[String(series.series_id)]
    return u?.trim() ? u : null
  }
  if (!shouldUseXtreamApiForActivePlaylist()) return null
  const creds = getXtreamCredentialsForApp()
  try {
    const eps = await fetchXtreamSeriesEpisodes(creds, series.series_id)
    if (eps.length === 0) return null
    const first = eps[0]!
    return buildXtreamSeriesStreamUrl(creds, first.episodeId, first.extension)
  } catch {
    return null
  }
}

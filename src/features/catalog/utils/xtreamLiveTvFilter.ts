import type { XtreamLiveCategory, XtreamLiveStream } from '@/services/xtream'
import { isLiveTvSectionLabelExcluded } from '@/lib/liveTvSectionLabelFilter'

/**
 * Categorias devolvidas por `get_live_categories` cujo nome indica biblioteca VOD/filmes/séries,
 * não canais lineares — alguns painéis listam-nas na secção “live” e incham a lista.
 */
export function isXtreamLiveCategoryExcludedFromTv(categoryName: string): boolean {
  return isLiveTvSectionLabelExcluded(categoryName)
}

const normName = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

/**
 * Linhas em `get_live_streams` que são claramente filme/série/VOD (painéis mal configurados).
 */
export function isXtreamLiveStreamExcludedFromTv(s: XtreamLiveStream): boolean {
  const t = (s.stream_type ?? '').trim().toLowerCase()
  if (
    t === 'movie' ||
    t === 'movies' ||
    t === 'vod' ||
    t === 'series' ||
    t === 'episode' ||
    t === 'episodes' ||
    t === 'created_movie'
  ) {
    return true
  }
  const u = (s.playbackUrlFromApi ?? '').toLowerCase()
  if (u.includes('/movie/') || u.includes('/series/') || u.includes('/vod/')) return true

  const ext = (s.container_extension ?? '').trim().toLowerCase()
  if (ext && ['mp4', 'mkv', 'avi', 'mov', 'wmv'].includes(ext)) return true

  const nm = normName(s.name ?? '')
  if (/\bS\d{1,2}\s*[Ee]\s*\d{1,3}\b/.test(nm)) return true
  if (/\bS\d{1,2}\s*\.\s*[Ee]\s*\d{1,3}\b/.test(nm)) return true

  return false
}

export function filterXtreamLiveDataForTv(
  categories: XtreamLiveCategory[],
  streams: XtreamLiveStream[],
): { categories: XtreamLiveCategory[]; streams: XtreamLiveStream[] } {
  const excludedCatIds = new Set<string>()
  const categoriesOut = categories.filter((c) => {
    if (isXtreamLiveCategoryExcludedFromTv(c.category_name)) {
      excludedCatIds.add(String(c.category_id))
      return false
    }
    return true
  })
  const streamsOut = streams.filter((s) => {
    if (isXtreamLiveStreamExcludedFromTv(s)) return false
    const cid = s.category_id != null ? String(s.category_id) : ''
    if (cid && excludedCatIds.has(cid)) return false
    return true
  })
  return { categories: categoriesOut, streams: streamsOut }
}

import { normalizeCategoryDisplayName } from '@/lib/categoryDisplay'
import type { M3uEntry } from '@/services/m3u'
import type { XtreamSeriesCategory, XtreamSeriesStream } from '@/services/xtream'

/**
 * Converte entradas M3U (séries) no formato usado com a API Xtream.
 */
export function buildM3uSeriesCatalog(entries: M3uEntry[]): {
  categories: XtreamSeriesCategory[]
  series: XtreamSeriesStream[]
  seriesIdToUrl: Map<number, string>
} {
  const rawGroups = [...new Set(entries.map(e => (e.groupTitle || 'Series').trim() || 'Series'))]
  const categories: XtreamSeriesCategory[] = rawGroups.map((name, i) => ({
    category_id: `m3u-${i}`,
    category_name: normalizeCategoryDisplayName(name),
  }))
  const rawToId = new Map(rawGroups.map((n, i) => [n, `m3u-${i}`]))

  const series: XtreamSeriesStream[] = entries.map((e, idx) => {
    const raw = (e.groupTitle || 'Series').trim() || 'Series'
    return {
      series_id: idx + 1,
      name: e.name,
      cover: e.tvgLogo?.trim() ? e.tvgLogo : undefined,
      category_id: rawToId.get(raw) ?? 'm3u-0',
    }
  })

  const seriesIdToUrl = new Map<number, string>(entries.map((e, i) => [i + 1, e.url]))

  return { categories, series, seriesIdToUrl }
}

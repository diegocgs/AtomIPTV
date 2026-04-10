/**
 * Espelha `filterM3uEntriesForSeries` do cliente.
 * @param {Array<{ name: string, url: string, groupTitle?: string, tvgLogo?: string, tvgId?: string }>} entries
 */
const MOVIE_PATH = /\/movie\//i
const SERIES_PATH = /\/series\//i
const LIVE_PATH = /\/live\//i
const HLS_MANIFEST = /\.m3u8(\?|#|$)/i
const SERIES_GROUP_HINT = /\b(series|seriados?|tv shows?|s\d{1,2}\s*e\d{1,2}|temporada|season\s*\d+)\b/i
const MOVIE_GROUP_HINT = /\b(vod|movie|movies|films?|cinema|4k[\s-]?movies?|uhd)\b/i

export function filterM3uEntriesForSeries(entries) {
  const primary = entries.filter((e) => {
    const u = String(e.url ?? '').trim()
    if (!u) return false
    if (MOVIE_PATH.test(u) && !SERIES_PATH.test(u)) return false
    if (SERIES_PATH.test(u)) return true
    if (LIVE_PATH.test(u) && !SERIES_PATH.test(u)) return false
    const g = String(e.groupTitle ?? '').toLowerCase()
    if (SERIES_GROUP_HINT.test(g) && !MOVIE_GROUP_HINT.test(g)) return true
    if (/\b[Ss]\d{1,2}\s*[EeXx]\s*\d{1,3}\b/.test(e.name ?? '')) return true
    return false
  })
  if (primary.length > 0) return primary
  return entries.filter((e) => {
    const u = String(e.url ?? '').trim()
    return Boolean(u && SERIES_PATH.test(u))
  })
}

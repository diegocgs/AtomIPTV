/**
 * Espelha `filterM3uEntriesForVodMovies` do cliente — entradas VOD/filme em listas M3U.
 * @param {Array<{ name: string, url: string, groupTitle?: string, tvgLogo?: string, tvgId?: string }>} entries
 */
const MOVIE_PATH = /\/movie\//i
const SERIES_PATH = /\/series\//i
const LIVE_PATH = /\/live\//i
const VOD_PATH = /\/vod\//i
const VIDEO_FILE = /\.(mp4|mkv|avi|mov|wmv|flv|webm|mpg|mpeg)(\?|#|$)/i
const HLS_MANIFEST = /\.m3u8(\?|#|$)/i
const SERIES_GROUP_HINT = /\b(series|seriados?|tv shows?|s\d{1,2}\s*e\d{1,2}|temporada|season\s*\d+)\b/i
const MOVIE_GROUP_HINT = /\b(vod|movie|movies|films?|cinema|4k[\s-]?movies?|uhd)\b/i

function groupSuggestsVodOrSeries(groupTitle) {
  const s = String(groupTitle ?? '').toLowerCase()
  return /\b(vod|movie|movies|films?|cinema|series|seriados?|tv shows?|box[\s-]?sets?)\b/.test(s)
}

export function filterM3uEntriesForVodMovies(entries) {
  const pick = (list) =>
    list.filter((e) => {
      const u = String(e.url ?? '').trim()
      if (!u) return false
      if (SERIES_PATH.test(u)) return false
      if (
        LIVE_PATH.test(u) &&
        !MOVIE_PATH.test(u) &&
        !VOD_PATH.test(u) &&
        !HLS_MANIFEST.test(u)
      ) {
        return false
      }
      if (MOVIE_PATH.test(u) || VOD_PATH.test(u)) return true
      if (VIDEO_FILE.test(u)) return true
      if (HLS_MANIFEST.test(u)) {
        if (LIVE_PATH.test(u)) return false
        const g = String(e.groupTitle ?? '').toLowerCase()
        if (SERIES_GROUP_HINT.test(g)) return false
        if (MOVIE_GROUP_HINT.test(g)) return true
        if (groupSuggestsVodOrSeries(e.groupTitle) && MOVIE_GROUP_HINT.test(g)) return true
        return false
      }
      const g = String(e.groupTitle ?? '').toLowerCase()
      if (MOVIE_GROUP_HINT.test(g) && !SERIES_GROUP_HINT.test(g)) return true
      return false
    })

  const primary = pick(entries)
  if (primary.length > 0) return primary

  return entries.filter((e) => {
    const u = String(e.url ?? '').trim()
    if (!u || SERIES_PATH.test(u)) return false
    if (MOVIE_PATH.test(u) || VOD_PATH.test(u)) return true
    if (VIDEO_FILE.test(u)) return true
    return HLS_MANIFEST.test(u) && !LIVE_PATH.test(u)
  })
}

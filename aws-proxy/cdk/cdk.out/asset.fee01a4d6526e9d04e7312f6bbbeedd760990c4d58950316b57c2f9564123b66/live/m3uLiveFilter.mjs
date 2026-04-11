import { categoryNameExcludedFromLiveTv } from './xtreamLiveTvFilter.mjs'

const MOVIE_PATH = /\/movie\//i
const MOVIES_PATH = /\/movies\//i
const SERIES_PATH = /\/series\//i
const SERIE_PATH = /\/serie\//i
const SEASON_PATH = /\/season\//i
const EPISODE_PATH = /\/episodes?\//i
const LIVE_PATH = /\/live\//i
const VIDEO_FILE = /\.(mp4|mkv|avi|mov|wmv|flv|webm|mpg|mpeg|m4v)(\?|#|$)/i

function groupSuggestsVodOrSeries(groupTitle) {
  const s = String(groupTitle ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  return /\b(vod|season|seasons|episode|episodes|box[\s-]?sets?|on[\s-]*demand|biblioteca|library)\b/.test(s)
}

function groupIsStrongVodLike(groupTitle) {
  const s = String(groupTitle ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  if (!s) return false
  if (/(^|[\s|/\\>()[\]-])streaming\s*:/.test(s)) return true
  if (/(^|[\s|/\\>()[\]-])(vod|movies?|films?|series?|seasons?|episodes?|box[\s-]*sets?)\s*:/.test(s)) return true
  if (/(^|[\s|/\\>()[\]-])on[\s-]*demand\s*:/.test(s)) return true
  return false
}

function hasExplicitNonLivePath(url) {
  return (
    MOVIE_PATH.test(url) ||
    MOVIES_PATH.test(url) ||
    SERIES_PATH.test(url) ||
    SERIE_PATH.test(url) ||
    SEASON_PATH.test(url) ||
    EPISODE_PATH.test(url) ||
    /\/vod\//i.test(url)
  )
}

function titleSuggestsSeriesEpisode(name) {
  return /\bS\d{1,2}\s*[EeXx]\s*\d{1,3}\b/.test(String(name ?? ''))
}

/**
 * Paridade com `src/lib/m3uLive.ts` — group-title VOD/OTT deve filtrar mesmo quando a URL tem `/live/`.
 */
export function filterM3uEntriesForLive(entries) {
  const groupIsVodLike = (groupTitle) => categoryNameExcludedFromLiveTv(String(groupTitle ?? '').trim())

  const passesUrlShape = (e) => {
    const u = String(e.url ?? '').trim()
    if (!u) return false
    if (hasExplicitNonLivePath(u)) return false
    if (VIDEO_FILE.test(u)) return false
    return true
  }

  const filtered = entries.filter((e) => {
    if (!passesUrlShape(e)) return false
    const u = String(e.url ?? '').trim()
    if (groupIsStrongVodLike(e.groupTitle)) return false
    const supportingNonLive =
      groupIsVodLike(e.groupTitle) ||
      groupSuggestsVodOrSeries(e.groupTitle) ||
      titleSuggestsSeriesEpisode(e.name)
    if (supportingNonLive) return false
    if (LIVE_PATH.test(u)) return true
    return true
  })

  if (filtered.length > 0) return filtered

  const hasLiveUrl = entries.some((e) => LIVE_PATH.test(String(e.url ?? '').trim()))
  const structuralKeep = entries.filter((e) => {
    const u = String(e.url ?? '').trim()
    return Boolean(u) && !hasExplicitNonLivePath(u) && !VIDEO_FILE.test(u)
  })
  if (!hasLiveUrl && entries.length > 0) {
    if (structuralKeep.length > 0 && structuralKeep.length < entries.length) return structuralKeep
    return entries
  }
  return []
}

/** Paridade com `src/features/catalog/utils/xtreamLiveTvFilter.ts` — filtra VOD/filmes/séries da Live TV Xtream. */

function sectionHeaderVod(raw) {
  if (/^\s*streaming\s*:/i.test(raw)) return true
  if (/^\s*(vod|séries?|series?|seriados?|filmes?|movies?|cinema|show)\s*:/i.test(raw)) return true
  if (/^\s*on[\s-]*demand\s*:/i.test(raw)) return true
  return false
}

function explicitLinearChannelLabel(raw) {
  return /^\s*(canais|canal|channels?|tv)\s*:/i.test(String(raw ?? '').trim())
}

function ottVodLibraryName(name) {
  const n = String(name).toLowerCase()
  return /\b(netflix|amazon\s*prime|prime\s*video|disney\s*\+|disney\s*plus|disney\s*\+?\s*fox|apple\s*tv|crunchyroll|globoplay|discovery\s*\+|discovery\s*plus|reelshorts?|hbo\s*max|\bhbo\b|paramount\s*\+|peacock|funimation|starz|showtime|claro\s*video|brasil\s*paralelo|reel\s*short)\b/i.test(
    n,
  )
}

export function categoryNameExcludedFromLiveTv(name) {
  const raw = String(name ?? '').trim()
  if (!raw) return false
  if (sectionHeaderVod(raw)) return true
  if (explicitLinearChannelLabel(raw)) return false
  const n = raw.toLowerCase()
  if (/^(vod|on[\s-]*demand|box[\s-]*sets?)$/i.test(raw)) return true
  if (ottVodLibraryName(raw) && /\b(vod|on[\s-]*demand|biblioteca|library|box[\s-]*sets?)\b/.test(n)) {
    return true
  }
  return /\b(vod|vod[\s-]*movies?|movies?[\s-]*vod|filmes?[\s-]*vod|4k[\s-]*movies?|uhd[\s-]*movies?|cinema[\s-]*vod|ppv[\s-]*movies?|biblioteca[\s-]*(de|da)?[\s-]*(filmes?|series?)|on[\s-]*demand[\s-]*movies?|vod[\s-]*library|box[\s-]*sets?)\b/.test(
    n,
  )
}

function streamRowExcludedFromLiveTv(row) {
  const t = String(row.stream_type ?? '')
    .trim()
    .toLowerCase()
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
  const direct = String(row.direct_source ?? row.stream_url ?? row.url ?? '')
    .trim()
    .toLowerCase()
  if (direct.includes('/movie/') || direct.includes('/series/') || direct.includes('/vod/')) return true
  const ext = String(row.container_extension ?? '')
    .trim()
    .toLowerCase()
  if (ext && ['mp4', 'mkv', 'avi', 'mov', 'wmv'].includes(ext)) return true
  const nm = String(row.name ?? '').toLowerCase()
  if (/\bS\d{1,2}\s*[Ee]\s*\d{1,3}\b/.test(nm)) return true
  if (/\bS\d{1,2}\s*\.\s*[Ee]\s*\d{1,3}\b/.test(nm)) return true
  return false
}

export function filterXtreamLiveCatalogForTv(catRows, streamRows) {
  const excluded = new Set()
  const cats = catRows.filter((c) => {
    const nm = String(c.category_name ?? '')
    if (categoryNameExcludedFromLiveTv(nm)) {
      excluded.add(String(c.category_id))
      return false
    }
    return true
  })
  const streams = streamRows.filter((s) => {
    if (streamRowExcludedFromLiveTv(s)) return false
    const cid = s.category_id != null ? String(s.category_id) : ''
    if (cid && excluded.has(cid)) return false
    return true
  })
  return { categories: cats, streams }
}

/**
 * Regras partilhadas: nomes de secção/categoria/group-title que indicam VOD/séries/bibliotecas OTT,
 * não canais lineares (usado em Xtream e em filtros M3U).
 */

function normalizeLabel(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function sectionHeaderVod(raw: string): boolean {
  const t = normalizeLabel(raw.trim())
  if (/(^|[\s|/\\>()[\]-])streaming\s*:/.test(t)) return true
  if (/(^|[\s|/\\>()[\]-])(vod|movies?|films?|series?|seasons?|episodes?|box[\s-]*sets?)\s*:/.test(t)) return true
  if (/(^|[\s|/\\>()[\]-])on[\s-]*demand\s*:/.test(t)) return true
  return false
}

function explicitLinearChannelLabel(raw: string): boolean {
  const t = normalizeLabel(raw.trim())
  return /^(canais|canal|channels?|tv)\s*:/.test(t)
}

export function isLiveTvSectionLabelStrongExcluded(label: string): boolean {
  const raw = label.trim()
  if (!raw) return false
  return sectionHeaderVod(raw)
}

function ottVodLibraryName(categoryName: string): boolean {
  const n = normalizeLabel(categoryName)
  return /\b(netflix|amazon\s*prime|prime\s*video|disney\s*\+|disney\s*plus|disney\s*\+?\s*fox|apple\s*tv|crunchyroll|globoplay|discovery\s*\+|discovery\s*plus|reelshorts?|hbo\s*max|\bhbo\b|paramount\s*\+|peacock|funimation|starz|showtime|claro\s*video|brasil\s*paralelo|reel\s*short)\b/i.test(
    n,
  )
}

/** Categoria Xtream, group-title M3U, etc. */
export function isLiveTvSectionLabelExcluded(label: string): boolean {
  const raw = label.trim()
  if (!raw) return false
  if (sectionHeaderVod(raw)) return true
  if (explicitLinearChannelLabel(raw)) return false
  const n = normalizeLabel(raw)
  if (/^(vod|box[\s-]*sets?|on[\s-]*demand)$/i.test(n)) return true
  if (ottVodLibraryName(raw) && /\b(vod|on[\s-]*demand|biblioteca|library|box[\s-]*sets?)\b/.test(n)) {
    return true
  }
  return /\b(vod|vod[\s-]*movies?|movies?[\s-]*vod|films?[\s-]*vod|4k[\s-]*movies?|uhd[\s-]*movies?|ppv[\s-]*movies?|on[\s-]*demand[\s-]*movies?|vod[\s-]*library|biblioteca[\s-]*(de|da)?[\s-]*(filmes?|series?)|box[\s-]*sets?)\b/.test(
    n,
  )
}

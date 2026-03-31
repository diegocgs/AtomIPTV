/**
 * Muitas listas M3U (e alguns direct_source Xtream) usam o atalho
 * `http(s)://host:port/user/pass/streamId` sem o segmento `/live/` e sem extensão.
 * O formato correcto para live HLS em Xtream Codes é em geral:
 * `http(s)://host:port/live/user/pass/streamId.m3u8`
 */
export function normalizeLiveStreamUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return url
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return trimmed

    const path = u.pathname
    const parts = path.split('/').filter(Boolean)

    // .../user/pass/12345 (três segmentos, último só dígitos, sem "live")
    if (
      parts.length === 3 &&
      /^\d+$/.test(parts[2]!) &&
      parts[0] !== 'live' &&
      parts[0] !== 'movie' &&
      parts[0] !== 'series'
    ) {
      const user = parts[0]!
      const pass = parts[1]!
      const sid = parts[2]!
      u.pathname = `/live/${user}/${pass}/${sid}.m3u8`
      return u.toString()
    }

    // .../live/user/pass/12345 sem extensão
    if (
      parts.length === 4 &&
      parts[0] === 'live' &&
      /^\d+$/.test(parts[3]!) &&
      !parts[3]!.includes('.')
    ) {
      u.pathname = `${path}.m3u8`
      return u.toString()
    }
  } catch {
    return trimmed
  }
  return trimmed
}

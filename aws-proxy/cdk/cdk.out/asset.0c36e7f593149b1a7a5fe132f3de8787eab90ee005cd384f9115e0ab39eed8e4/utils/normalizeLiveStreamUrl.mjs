export function normalizeLiveStreamUrl(url) {
  const trimmed = String(url ?? '').trim()
  if (!trimmed) return ''
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return trimmed
    const path = u.pathname
    const parts = path.split('/').filter(Boolean)
    if (
      parts.length === 3 &&
      /^\d+$/.test(parts[2]) &&
      parts[0] !== 'live' &&
      parts[0] !== 'movie' &&
      parts[0] !== 'series'
    ) {
      u.pathname = `/live/${parts[0]}/${parts[1]}/${parts[2]}.m3u8`
      return u.toString()
    }
    if (
      parts.length === 4 &&
      parts[0] === 'live' &&
      /^\d+$/.test(parts[3]) &&
      !parts[3].includes('.')
    ) {
      u.pathname = `${path}.m3u8`
      return u.toString()
    }
  } catch {
    return trimmed
  }
  return trimmed
}

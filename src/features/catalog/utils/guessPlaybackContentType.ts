/** Heurística simples para placeholder / sessão — não substitui detecção no player. */
export function guessPlaybackContentType(uri: string): string | undefined {
  const u = uri.toLowerCase()
  if (u.includes('.m3u8') || u.endsWith('.m3u')) {
    return 'application/vnd.apple.mpegurl'
  }
  if (u.includes('.mpd')) return 'application/dash+xml'
  return undefined
}

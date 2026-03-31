import type { M3UPlaylistConfig, PlaylistResolution } from '../types/playlist'

export type M3UResolveResult = {
  config: M3UPlaylistConfig
  resolution: Extract<PlaylistResolution, { kind: 'm3u' }>
}

/**
 * Normaliza entrada M3U para persistência e para fases futuras (fetch + parse).
 * Sem rede nesta fase.
 */
export function resolveM3UPlaylist(rawUrl: string): M3UResolveResult {
  const url = rawUrl.trim()
  return {
    config: { url },
    resolution: {
      kind: 'm3u',
      playlistUrl: url,
      displayUrl: truncateDisplay(url),
    },
  }
}

function truncateDisplay(s: string, max = 64): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

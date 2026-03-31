import {
  playlistServiceEnsureDefaultSeeds,
  playlistServiceGetActivePlaylist,
  playlistServiceGetSnapshot,
} from './services/playlistService'

/** Estado mínimo para arranque / rotas (extensível nas fases seguintes). */
export function getPlaylistBootstrapState(): {
  hasActivePlaylist: boolean
  activePlaylistId: string | null
  playlistCount: number
} {
  playlistServiceEnsureDefaultSeeds()
  const snap = playlistServiceGetSnapshot()
  return {
    hasActivePlaylist: snap.activePlaylistId !== null,
    activePlaylistId: snap.activePlaylistId,
    playlistCount: snap.playlists.length,
  }
}

export function getActivePlaylistForApp(): ReturnType<typeof playlistServiceGetActivePlaylist> {
  return playlistServiceGetActivePlaylist()
}

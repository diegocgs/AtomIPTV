/**
 * Tipos canónicos de playlists: usar `@/features/playlists` como fonte.
 * Este ficheiro mantém re-exports para imports legados.
 */
export type {
  PlaylistEntity,
  PlaylistType,
  PlaylistStatus,
  M3UPlaylistConfig,
  XtreamPlaylistConfig,
  PlaylistResolution,
} from '@/features/playlists/types/playlist'
export { isM3UPlaylist, isXtreamPlaylist } from '@/features/playlists/types/playlist'

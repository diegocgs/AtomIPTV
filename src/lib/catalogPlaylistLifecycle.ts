import { deleteCatalogSnapshotsForPlaylist } from '@/lib/catalogSnapshotIdb'
import { clearLiveNavForPlaylist } from '@/lib/liveNavUxStorage'

/**
 * Chamado quando uma playlist é removida — limpa IDB, UX e caches em memória (import dinâmico evita ciclos).
 */
export function onPlaylistDeleted(playlistId: string): void {
  void deleteCatalogSnapshotsForPlaylist(playlistId)
  clearLiveNavForPlaylist(playlistId)
  void Promise.all([
    import('@/features/catalog/services/liveCatalogService'),
    import('@/features/catalog/services/moviesCatalogService'),
    import('@/features/catalog/services/seriesCatalogService'),
  ]).then(([live, movies, series]) => {
    live.liveCatalogInvalidateCache(playlistId)
    movies.moviesCatalogInvalidateCache(playlistId)
    series.seriesCatalogInvalidateCache(playlistId)
  })
}

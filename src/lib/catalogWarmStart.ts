import type { PlaylistEntity } from '@/features/playlists/types/playlist'
import type { CatalogSnapshotRecord } from './catalogSnapshotIdb'

/** TTL para marcar snapshot como “stale” (revalidar em background com prioridade). */
export const CATALOG_SNAPSHOT_TTL_MS = 12 * 60 * 60 * 1000

export function isCatalogSnapshotStale(cachedAtMs: number): boolean {
  return Date.now() - cachedAtMs > CATALOG_SNAPSHOT_TTL_MS
}

export function catalogSnapshotMatchesPlaylist(
  row: Pick<CatalogSnapshotRecord, 'playlistId' | 'playlistUpdatedAt' | 'sourceType'>,
  active: PlaylistEntity
): boolean {
  if (row.playlistId !== active.id) return false
  if (row.playlistUpdatedAt !== active.updatedAt) return false
  if (row.sourceType !== active.type) return false
  return true
}

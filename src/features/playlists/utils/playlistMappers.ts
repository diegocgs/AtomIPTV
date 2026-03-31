import type { PlaylistDialogEditModel } from '../types/form'
import type { PlaylistEntity, PlaylistStatus } from '../types/playlist'
import { isM3UPlaylist } from '../types/playlist'

export function getPlaylistCardSubtitle(entity: PlaylistEntity): string {
  if (isM3UPlaylist(entity)) return entity.m3u.url
  return entity.xtream.server
}

export function getPlaylistStatusLabel(status: PlaylistStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle'
    case 'validating':
      return 'Validating'
    case 'ready':
      return 'Ready'
    case 'error':
      return 'Error'
    default:
      return status
  }
}

export function entityToDialogEditModel(entity: PlaylistEntity): PlaylistDialogEditModel {
  if (isM3UPlaylist(entity)) {
    return {
      id: entity.id,
      kind: 'm3u',
      displayName: entity.name,
      sourceUrl: entity.m3u.url,
    }
  }
  return {
    id: entity.id,
    kind: 'xtream',
    displayName: entity.name,
    sourceUrl: entity.xtream.server,
    xtreamUsername: entity.xtream.username,
    xtreamPassword: entity.xtream.password,
  }
}

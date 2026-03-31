import { useCallback, useEffect, useState } from 'react'
import type { PlaylistCommitResult, PlaylistFormPayload } from '../types/form'
import { playlistStorageSubscribe } from '../services/playlistStorage'
import {
  playlistServiceDeletePlaylist,
  playlistServiceGetSnapshot,
  playlistServiceSetActivePlaylist,
  playlistServiceSubmitForm,
} from '../services/playlistService'

export function usePlaylists() {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    return playlistStorageSubscribe(() => setVersion((v) => v + 1))
  }, [])

  void version
  const snapshot = playlistServiceGetSnapshot()

  const submitForm = useCallback(
    (payload: PlaylistFormPayload, options?: { makeActiveOnAdd?: boolean }): PlaylistCommitResult => {
      return playlistServiceSubmitForm(payload, options)
    },
    [],
  )

  const setActivePlaylist = useCallback((id: string | null): PlaylistCommitResult => {
    return playlistServiceSetActivePlaylist(id)
  }, [])

  const deletePlaylist = useCallback((id: string) => {
    playlistServiceDeletePlaylist(id)
  }, [])

  return {
    playlists: snapshot.playlists,
    activePlaylistId: snapshot.activePlaylistId,
    submitForm,
    setActivePlaylist,
    deletePlaylist,
    revision: version,
  }
}

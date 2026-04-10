import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePlaylists } from '@/features/playlists/hooks/usePlaylists'
import { CATALOG_REFRESH_EVENT, type CatalogRefreshDetail } from '@/lib/catalogRefreshEvents'
import {
  getLiveCatalogForActivePlaylist,
  peekLiveCatalogMemoryCacheForActivePlaylist,
} from '../services/liveCatalogService'
import type {
  LiveCatalogEmptyReason,
  LiveCatalogSourceKind,
  LiveCategory,
  LiveChannel,
} from '../types/liveCatalog'

export type LiveCatalogEmptyState =
  | { reason: null }
  | { reason: LiveCatalogEmptyReason; message?: string }

export type UseLiveCatalogResult = {
  categories: LiveCategory[]
  channels: LiveChannel[]
  isLoading: boolean
  error: string | null
  emptyState: LiveCatalogEmptyState
  reload: () => Promise<void>
  hasActivePlaylist: boolean
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

function getInitialLiveCatalogState() {
  const seeded = peekLiveCatalogMemoryCacheForActivePlaylist()
  return {
    categories: seeded?.categories ?? [],
    channels: seeded?.channels ?? [],
    sourceType: seeded?.sourceType ?? ('none' as LiveCatalogSourceKind),
    isLoading: seeded == null,
    error: null as string | null,
  }
}

export function useLiveCatalog(): UseLiveCatalogResult {
  const { activePlaylistId, revision } = usePlaylists()
  const [categories, setCategories] = useState<LiveCategory[]>(() => getInitialLiveCatalogState().categories)
  const [channels, setChannels] = useState<LiveChannel[]>(() => getInitialLiveCatalogState().channels)
  const [sourceType, setSourceType] = useState<LiveCatalogSourceKind>(() => getInitialLiveCatalogState().sourceType)
  const [isLoading, setIsLoading] = useState(() => getInitialLiveCatalogState().isLoading)
  const [error, setError] = useState<string | null>(() => getInitialLiveCatalogState().error)

  useEffect(() => {
    const ac = new AbortController()
    let cancelled = false
    const seeded = peekLiveCatalogMemoryCacheForActivePlaylist()

    if (seeded) {
      setCategories(seeded.categories)
      setChannels(seeded.channels)
      setSourceType(seeded.sourceType)
      setError(null)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }
    setError(null)

    ;(async () => {
      try {
        const result = await getLiveCatalogForActivePlaylist({ signal: ac.signal })
        if (cancelled) return
        setCategories(result.categories)
        setChannels(result.channels)
        setSourceType(result.sourceType)
      } catch (e) {
        if (cancelled || isAbortError(e)) return
        const msg = e instanceof Error ? e.message : 'Erro ao carregar catálogo.'
        setError(msg)
        setCategories([])
        setChannels([])
        setSourceType('none')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [revision, activePlaylistId])

  useEffect(() => {
    const handler = (ev: Event): void => {
      const d = (ev as CustomEvent<CatalogRefreshDetail>).detail
      if (!d || d.kind !== 'live' || d.playlistId !== activePlaylistId) return
      setCategories(d.result.categories)
      setChannels(d.result.channels)
      setSourceType(d.result.sourceType)
    }
    window.addEventListener(CATALOG_REFRESH_EVENT, handler as EventListener)
    return () => window.removeEventListener(CATALOG_REFRESH_EVENT, handler as EventListener)
  }, [activePlaylistId])

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getLiveCatalogForActivePlaylist({ forceRefresh: true })
      setCategories(result.categories)
      setChannels(result.channels)
      setSourceType(result.sourceType)
    } catch (e) {
      if (isAbortError(e)) return
      const msg = e instanceof Error ? e.message : 'Erro ao carregar catálogo.'
      setError(msg)
      setCategories([])
      setChannels([])
      setSourceType('none')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const hasActivePlaylist = Boolean(activePlaylistId)

  const emptyState = useMemo((): LiveCatalogEmptyState => {
    if (isLoading) return { reason: null }
    if (error) return { reason: 'fetch_failed', message: error }
    if (!hasActivePlaylist) return { reason: 'no_active_playlist' }
    if (channels.length === 0) {
      if (sourceType === 'none') {
        return {
          reason: 'no_channels',
          message: 'Playlist sem URL ou credenciais válidas.',
        }
      }
      return { reason: 'no_channels' }
    }
    return { reason: null }
  }, [isLoading, error, hasActivePlaylist, channels.length, sourceType])

  return {
    categories,
    channels,
    isLoading,
    error,
    emptyState,
    reload,
    hasActivePlaylist,
  }
}

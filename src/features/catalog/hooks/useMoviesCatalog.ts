import { useCallback, useEffect, useState } from 'react'
import { usePlaylists } from '@/features/playlists/hooks/usePlaylists'
import { CATALOG_REFRESH_EVENT, type CatalogRefreshDetail } from '@/lib/catalogRefreshEvents'
import type { MoviesCatalogSourceKind } from '../types/moviesCatalog'
import {
  getMoviesCatalogForActivePlaylist,
  peekMoviesCatalogMemoryCacheForActivePlaylist,
} from '../services/moviesCatalogService'
import type { XtreamVodCategory, XtreamVodStream } from '@/services/xtream'

export type UseMoviesCatalogResult = {
  vodCategories: XtreamVodCategory[]
  vodStreams: XtreamVodStream[]
  vodSourceType: MoviesCatalogSourceKind
  m3uStreamUrls: Record<string, string> | undefined
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

export function useMoviesCatalog(): UseMoviesCatalogResult {
  const { activePlaylistId, revision } = usePlaylists()
  const getInitialMoviesCatalogState = () => {
    const seeded = peekMoviesCatalogMemoryCacheForActivePlaylist()
    return {
      categories: seeded?.categories ?? [],
      streams: seeded?.streams ?? [],
      sourceType: seeded?.sourceType ?? ('none' as MoviesCatalogSourceKind),
      m3uStreamUrls: seeded?.m3uStreamUrls,
      isLoading: seeded == null,
      error: null as string | null,
    }
  }
  const [vodCategories, setVodCategories] = useState<XtreamVodCategory[]>(
    () => getInitialMoviesCatalogState().categories,
  )
  const [vodStreams, setVodStreams] = useState<XtreamVodStream[]>(
    () => getInitialMoviesCatalogState().streams,
  )
  const [vodSourceType, setVodSourceType] = useState<MoviesCatalogSourceKind>(
    () => getInitialMoviesCatalogState().sourceType,
  )
  const [m3uStreamUrls, setM3uStreamUrls] = useState<Record<string, string> | undefined>(
    () => getInitialMoviesCatalogState().m3uStreamUrls,
  )
  const [isLoading, setIsLoading] = useState(() => getInitialMoviesCatalogState().isLoading)
  const [error, setError] = useState<string | null>(() => getInitialMoviesCatalogState().error)

  useEffect(() => {
    const ac = new AbortController()
    let cancelled = false
    const seeded = peekMoviesCatalogMemoryCacheForActivePlaylist()

    if (seeded) {
      setVodCategories(seeded.categories)
      setVodStreams(seeded.streams)
      setVodSourceType(seeded.sourceType)
      setM3uStreamUrls(seeded.m3uStreamUrls)
      setError(null)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }
    setError(null)
    ;(async () => {
      try {
        const data = await getMoviesCatalogForActivePlaylist({ signal: ac.signal })
        if (cancelled) return
        setVodCategories(data.categories)
        setVodStreams(data.streams)
        setVodSourceType(data.sourceType)
        setM3uStreamUrls(data.m3uStreamUrls)
      } catch (e) {
        if (cancelled || isAbortError(e)) return
        setError(e instanceof Error ? e.message : 'Failed to load movies.')
        setVodCategories([])
        setVodStreams([])
        setVodSourceType('none')
        setM3uStreamUrls(undefined)
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
      if (!d || d.kind !== 'movies' || d.playlistId !== activePlaylistId) return
      setVodCategories(d.result.categories)
      setVodStreams(d.result.streams)
      setVodSourceType(d.result.sourceType)
      setM3uStreamUrls(d.result.m3uStreamUrls)
    }
    window.addEventListener(CATALOG_REFRESH_EVENT, handler as EventListener)
    return () => window.removeEventListener(CATALOG_REFRESH_EVENT, handler as EventListener)
  }, [activePlaylistId])

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getMoviesCatalogForActivePlaylist({ forceRefresh: true })
      setVodCategories(data.categories)
      setVodStreams(data.streams)
      setVodSourceType(data.sourceType)
      setM3uStreamUrls(data.m3uStreamUrls)
    } catch (e) {
      if (isAbortError(e)) return
      setError(e instanceof Error ? e.message : 'Failed to load movies.')
      setVodCategories([])
      setVodStreams([])
      setVodSourceType('none')
      setM3uStreamUrls(undefined)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { vodCategories, vodStreams, vodSourceType, m3uStreamUrls, isLoading, error, reload }
}

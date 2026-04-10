import { useCallback, useEffect, useState } from 'react'
import { usePlaylists } from '@/features/playlists/hooks/usePlaylists'
import { CATALOG_REFRESH_EVENT, type CatalogRefreshDetail } from '@/lib/catalogRefreshEvents'
import type { SeriesCatalogSourceKind } from '../types/seriesCatalog'
import {
  getSeriesCatalogForActivePlaylist,
  peekSeriesCatalogMemoryCacheForActivePlaylist,
} from '../services/seriesCatalogService'
import type { XtreamSeriesCategory, XtreamSeriesStream } from '@/services/xtream'

export type UseSeriesCatalogResult = {
  seriesCategories: XtreamSeriesCategory[]
  seriesRows: XtreamSeriesStream[]
  seriesSourceType: SeriesCatalogSourceKind
  m3uSeriesUrls: Record<string, string> | undefined
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

export function useSeriesCatalog(): UseSeriesCatalogResult {
  const { activePlaylistId, revision } = usePlaylists()
  const getInitialSeriesCatalogState = () => {
    const seeded = peekSeriesCatalogMemoryCacheForActivePlaylist()
    return {
      categories: seeded?.categories ?? [],
      series: seeded?.series ?? [],
      sourceType: seeded?.sourceType ?? ('none' as SeriesCatalogSourceKind),
      m3uSeriesUrls: seeded?.m3uSeriesUrls,
      isLoading: seeded == null,
      error: null as string | null,
    }
  }
  const [seriesCategories, setSeriesCategories] = useState<XtreamSeriesCategory[]>(
    () => getInitialSeriesCatalogState().categories,
  )
  const [seriesRows, setSeriesRows] = useState<XtreamSeriesStream[]>(
    () => getInitialSeriesCatalogState().series,
  )
  const [seriesSourceType, setSeriesSourceType] = useState<SeriesCatalogSourceKind>(
    () => getInitialSeriesCatalogState().sourceType,
  )
  const [m3uSeriesUrls, setM3uSeriesUrls] = useState<Record<string, string> | undefined>(
    () => getInitialSeriesCatalogState().m3uSeriesUrls,
  )
  const [isLoading, setIsLoading] = useState(() => getInitialSeriesCatalogState().isLoading)
  const [error, setError] = useState<string | null>(() => getInitialSeriesCatalogState().error)

  useEffect(() => {
    const ac = new AbortController()
    let cancelled = false
    const seeded = peekSeriesCatalogMemoryCacheForActivePlaylist()

    if (seeded) {
      setSeriesCategories(seeded.categories)
      setSeriesRows(seeded.series)
      setSeriesSourceType(seeded.sourceType)
      setM3uSeriesUrls(seeded.m3uSeriesUrls)
      setError(null)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }
    setError(null)
    ;(async () => {
      try {
        const data = await getSeriesCatalogForActivePlaylist({ signal: ac.signal })
        if (cancelled) return
        setSeriesCategories(data.categories)
        setSeriesRows(data.series)
        setSeriesSourceType(data.sourceType)
        setM3uSeriesUrls(data.m3uSeriesUrls)
      } catch (e) {
        if (cancelled || isAbortError(e)) return
        setError(e instanceof Error ? e.message : 'Failed to load series.')
        setSeriesCategories([])
        setSeriesRows([])
        setSeriesSourceType('none')
        setM3uSeriesUrls(undefined)
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
      if (!d || d.kind !== 'series' || d.playlistId !== activePlaylistId) return
      setSeriesCategories(d.result.categories)
      setSeriesRows(d.result.series)
      setSeriesSourceType(d.result.sourceType)
      setM3uSeriesUrls(d.result.m3uSeriesUrls)
    }
    window.addEventListener(CATALOG_REFRESH_EVENT, handler as EventListener)
    return () => window.removeEventListener(CATALOG_REFRESH_EVENT, handler as EventListener)
  }, [activePlaylistId])

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getSeriesCatalogForActivePlaylist({ forceRefresh: true })
      setSeriesCategories(data.categories)
      setSeriesRows(data.series)
      setSeriesSourceType(data.sourceType)
      setM3uSeriesUrls(data.m3uSeriesUrls)
    } catch (e) {
      if (isAbortError(e)) return
      setError(e instanceof Error ? e.message : 'Failed to load series.')
      setSeriesCategories([])
      setSeriesRows([])
      setSeriesSourceType('none')
      setM3uSeriesUrls(undefined)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    seriesCategories,
    seriesRows,
    seriesSourceType,
    m3uSeriesUrls,
    isLoading,
    error,
    reload,
  }
}

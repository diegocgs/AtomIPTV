import { playlistServiceGetActivePlaylist } from '@/features/playlists/services/playlistService'
import {
  deleteAllSnapshotsOfKind,
  deleteCatalogSnapshot,
  getCatalogSnapshot,
  putCatalogSnapshot,
} from '@/lib/catalogSnapshotIdb'
import { dispatchCatalogRefresh } from '@/lib/catalogRefreshEvents'
import { catalogSnapshotMatchesPlaylist, isCatalogSnapshotStale } from '@/lib/catalogWarmStart'
import type { PlaylistEntity } from '@/features/playlists/types/playlist'
import type { SeriesCatalogResult } from '../types/seriesCatalog'
import { parseM3u } from '@/services/m3u'
import { getM3uPlaylistBody, putM3uPlaylistBody } from '@/lib/m3uPlaylistCache'
import { filterM3uEntriesForSeries } from '@/lib/m3uLive'
import { buildM3uSeriesCatalog } from '@/lib/m3uSeriesCatalog'
import { buildM3uDownloadRequestUrl } from '@/lib/m3uFetchUrl'
import { smartHttpGet } from '@/lib/proxyClientGet'
import { fetchXtreamSeries, fetchXtreamSeriesCategories } from '@/services/xtream'
import { buildHybridApiUrl } from '@/lib/hybridApiOrigin'
import {
  getXtreamCredentialsForApp,
  shouldUseXtreamApiForActivePlaylist,
} from '@/lib/playlistsStorage'

type CacheEntry = { result: SeriesCatalogResult; playlistRevision: string }

const memoryCache = new Map<string, CacheEntry>()

const seriesRevalidateGen = new Map<string, number>()

function cacheKey(playlist: PlaylistEntity): string {
  return `${playlist.id}:${playlist.updatedAt}`
}

export function peekSeriesCatalogMemoryCacheForActivePlaylist(): SeriesCatalogResult | null {
  const active = playlistServiceGetActivePlaylist()
  if (!active) return null

  const hit = memoryCache.get(active.id)
  if (!hit) return null

  if (hit.playlistRevision !== cacheKey(active)) {
    return null
  }

  return hit.result
}

function m3uUrlFromEntity(p: PlaylistEntity & { type: 'm3u' }): string {
  if (p.resolution?.kind === 'm3u' && p.resolution.playlistUrl.trim()) {
    return p.resolution.playlistUrl.trim()
  }
  return p.m3u.url.trim()
}

function xtreamBaseFromEntity(p: PlaylistEntity & { type: 'xtream' }): string {
  if (p.resolution?.kind === 'xtream' && p.resolution.apiBaseUrl.trim()) {
    return p.resolution.apiBaseUrl.trim()
  }
  return p.xtream.server.trim()
}

function emptyNoPlaylist(): SeriesCatalogResult {
  return {
    categories: [],
    series: [],
    sourceType: 'none',
    loadedAt: Date.now(),
  }
}

function buildSeriesCatalogApiUrl(active: PlaylistEntity): string | null {
  const qp = new URLSearchParams({
    playlistId: active.id,
    playlistName: active.name,
    sourceType: active.type,
  })

  if (active.type === 'm3u') {
    const m3uUrl = m3uUrlFromEntity(active)
    if (!m3uUrl) return null
    qp.set('m3uUrl', m3uUrl)
  } else {
    const baseUrl = xtreamBaseFromEntity(active)
    const username = active.xtream.username.trim()
    const password = active.xtream.password
    if (!baseUrl || !username || !password) return null
    qp.set('baseUrl', baseUrl)
    qp.set('username', username)
    qp.set('password', password)
  }

  return buildHybridApiUrl('/api/vod/series/catalog', qp)
}

async function fetchSeriesCatalogFromBackend(
  url: string,
  signal?: AbortSignal
): Promise<SeriesCatalogResult> {
  const res = await fetch(url, { method: 'GET', signal })
  if (!res.ok) {
    const hint = await res.text().catch(() => '')
    throw new Error(
      `Series catalog API failed (${res.status})${hint ? `: ${hint.slice(0, 200)}` : ''}`
    )
  }
  const json = (await res.json()) as SeriesCatalogResult
  return json
}

async function resolveSeriesCatalogInClient(): Promise<SeriesCatalogResult> {
  if (shouldUseXtreamApiForActivePlaylist()) {
    const credentials = getXtreamCredentialsForApp()
    if (!credentials.serverUrl?.trim() || !credentials.username?.trim()) {
      return emptyNoPlaylist()
    }
    const [cats, rows] = await Promise.all([
      fetchXtreamSeriesCategories(credentials),
      fetchXtreamSeries(credentials),
    ])
    return {
      categories: cats,
      series: rows,
      sourceType: 'xtream',
      loadedAt: Date.now(),
    }
  }

  const active = playlistServiceGetActivePlaylist()
  if (!active || active.type !== 'm3u') {
    return emptyNoPlaylist()
  }

  const m3uUrl = m3uUrlFromEntity(active)
  if (!m3uUrl) return emptyNoPlaylist()

  let body = await getM3uPlaylistBody(active.id, m3uUrl)
  if (!body) {
    const res = await smartHttpGet(buildM3uDownloadRequestUrl(m3uUrl), { method: 'GET' })
    if (!res.ok) throw new Error(`M3U download failed (${res.status}).`)
    body = await res.text()
    void putM3uPlaylistBody(active.id, m3uUrl, body).catch(() => {})
  }
  const entries = filterM3uEntriesForSeries(parseM3u(body))
  const built = buildM3uSeriesCatalog(entries)
  return {
    categories: built.categories,
    series: built.series,
    m3uSeriesUrls: Object.fromEntries(built.seriesIdToUrl),
    sourceType: 'm3u',
    loadedAt: Date.now(),
  }
}

async function persistSeriesSnapshot(active: PlaylistEntity, result: SeriesCatalogResult): Promise<void> {
  await putCatalogSnapshot({
    kind: 'series',
    playlistId: active.id,
    playlistUpdatedAt: active.updatedAt,
    sourceType: result.sourceType,
    cachedAtMs: Date.now(),
    payload: result,
  })
}

function scheduleSeriesBackgroundRevalidate(active: PlaylistEntity, revisionKey: string): void {
  const id = active.id
  const gen = (seriesRevalidateGen.get(id) ?? 0) + 1
  seriesRevalidateGen.set(id, gen)
  const apiUrl = buildSeriesCatalogApiUrl(active)
  if (!apiUrl) return
  void (async () => {
    try {
      const result = await fetchSeriesCatalogFromBackend(apiUrl)
      if (seriesRevalidateGen.get(id) !== gen) return
      const cur = playlistServiceGetActivePlaylist()
      if (!cur || cur.id !== id || cacheKey(cur) !== revisionKey) return
      result.meta = { playlistName: cur.name, playlistId: cur.id }
      memoryCache.set(id, { result, playlistRevision: revisionKey })
      await persistSeriesSnapshot(cur, result)
      dispatchCatalogRefresh({ kind: 'series', playlistId: id, result })
    } catch {
      /* silencioso */
    }
  })()
}

/**
 * Catálogo de séries para a playlist activa — tenta API híbrida e cai para resolução no cliente.
 */
export async function getSeriesCatalogForActivePlaylist(options?: {
  forceRefresh?: boolean
  signal?: AbortSignal
}): Promise<SeriesCatalogResult> {
  options?.signal?.throwIfAborted()

  const active = playlistServiceGetActivePlaylist()
  if (!active) {
    return emptyNoPlaylist()
  }

  const key = cacheKey(active)
  if (!options?.forceRefresh) {
    const hit = memoryCache.get(active.id)
    if (hit && hit.playlistRevision === key) {
      return hit.result
    }
  }

  if (!options?.forceRefresh) {
    const row = await getCatalogSnapshot('series', active.id)
    if (row && catalogSnapshotMatchesPlaylist(row, active)) {
      const parsed = JSON.parse(JSON.stringify(row.payload)) as SeriesCatalogResult
      parsed.meta = { playlistName: active.name, playlistId: active.id }
      memoryCache.set(active.id, { result: parsed, playlistRevision: key })
      if (isCatalogSnapshotStale(row.cachedAtMs)) {
        scheduleSeriesBackgroundRevalidate(active, key)
      }
      return parsed
    }
  }

  const apiUrl = buildSeriesCatalogApiUrl(active)
  if (!apiUrl) {
    const result = emptyNoPlaylist()
    result.meta = { playlistName: active.name, playlistId: active.id }
    memoryCache.set(active.id, { result, playlistRevision: key })
    return result
  }

  let result: SeriesCatalogResult
  try {
    result = await fetchSeriesCatalogFromBackend(apiUrl, options?.signal)
  } catch {
    try {
      result = await resolveSeriesCatalogInClient()
    } catch {
      result = emptyNoPlaylist()
    }
  }

  result.meta = { playlistName: active.name, playlistId: active.id }
  memoryCache.set(active.id, { result, playlistRevision: key })
  void persistSeriesSnapshot(active, result)
  return result
}

export function seriesCatalogInvalidateCache(playlistId?: string): void {
  if (playlistId) {
    memoryCache.delete(playlistId)
    void deleteCatalogSnapshot('series', playlistId)
  } else {
    memoryCache.clear()
    void deleteAllSnapshotsOfKind('series')
  }
}

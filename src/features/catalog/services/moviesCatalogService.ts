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
import type { MoviesCatalogResult } from '../types/moviesCatalog'
import { parseM3u } from '@/services/m3u'
import { getM3uPlaylistBody, putM3uPlaylistBody } from '@/lib/m3uPlaylistCache'
import { filterM3uEntriesForVodMovies } from '@/lib/m3uLive'
import { buildM3uVodMovieCatalog } from '@/lib/m3uVodCatalog'
import { buildM3uDownloadRequestUrl } from '@/lib/m3uFetchUrl'
import { smartHttpGet } from '@/lib/proxyClientGet'
import {
  fetchXtreamVodCategories,
  fetchXtreamVodStreams,
} from '@/services/xtream'
import { directXtreamVodFetch } from '../utils/directXtreamFetch'
import { buildHybridApiUrl } from '@/lib/hybridApiOrigin'
import {
  getXtreamCredentialsForApp,
  shouldUseXtreamApiForActivePlaylist,
} from '@/lib/playlistsStorage'

type CacheEntry = { result: MoviesCatalogResult; playlistRevision: string }

const memoryCache = new Map<string, CacheEntry>()

const moviesRevalidateGen = new Map<string, number>()
const moviesRevalidateAbort = new Map<string, AbortController>()

function cacheKey(playlist: PlaylistEntity): string {
  return `${playlist.id}:${playlist.updatedAt}`
}

export function peekMoviesCatalogMemoryCacheForActivePlaylist(): MoviesCatalogResult | null {
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

function emptyNoPlaylist(): MoviesCatalogResult {
  return {
    categories: [],
    streams: [],
    sourceType: 'none',
    loadedAt: Date.now(),
  }
}

function buildMoviesCatalogApiUrl(active: PlaylistEntity): string | null {
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

  return buildHybridApiUrl('/api/vod/movies/catalog', qp)
}

async function fetchMoviesCatalogFromBackend(
  url: string,
  signal?: AbortSignal
): Promise<MoviesCatalogResult> {
  const res = await fetch(url, { method: 'GET', signal })
  if (!res.ok) {
    const hint = await res.text().catch(() => '')
    throw new Error(
      `Movies catalog API failed (${res.status})${hint ? `: ${hint.slice(0, 200)}` : ''}`
    )
  }
  const json = (await res.json()) as MoviesCatalogResult
  return json
}

async function resolveMoviesCatalogInClient(): Promise<MoviesCatalogResult> {
  if (shouldUseXtreamApiForActivePlaylist()) {
    const credentials = getXtreamCredentialsForApp()
    if (!credentials.serverUrl?.trim() || !credentials.username?.trim()) {
      console.warn('[MoviesCatalog] Xtream credentials empty, returning empty')
      return emptyNoPlaylist()
    }
    try {
      const [cats, streams] = await Promise.all([
        fetchXtreamVodCategories(credentials),
        fetchXtreamVodStreams(credentials),
      ])
      console.info('[MoviesCatalog] Xtream direct OK — cats:', cats.length, 'streams:', streams.length)
      return {
        categories: cats,
        streams,
        sourceType: 'xtream',
        loadedAt: Date.now(),
      }
    } catch (err) {
      console.error('[MoviesCatalog] Xtream direct FAILED:', err)
      throw err
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
    try {
      const res = await smartHttpGet(buildM3uDownloadRequestUrl(m3uUrl), { method: 'GET' })
      if (!res.ok) throw new Error(`M3U download failed (${res.status}).`)
      body = await res.text()
      void putM3uPlaylistBody(active.id, m3uUrl, body).catch(() => {})
    } catch {
      // Fallback: Xtream API direto (JSON leve). Resolve short links automaticamente.
      const direct = await directXtreamVodFetch(m3uUrl)
      if (direct) return direct
      // DEV: proxy inline do Vite.
      if (import.meta.env.DEV) {
        try {
          const dr = await fetch(`/__iptv_dev/fetch?url=${encodeURIComponent(m3uUrl)}`, { method: 'GET', cache: 'no-store' })
          if (dr.ok) {
            body = await dr.text()
            void putM3uPlaylistBody(active.id, m3uUrl, body).catch(() => {})
          }
        } catch { /* fallthrough */ }
      }
      if (!body) throw new Error('M3U download failed (all attempts)')
    }
  }
  const entries = filterM3uEntriesForVodMovies(parseM3u(body))
  const built = buildM3uVodMovieCatalog(entries)
  return {
    categories: built.categories,
    streams: built.streams,
    m3uStreamUrls: Object.fromEntries(built.streamIdToUrl),
    sourceType: 'm3u',
    loadedAt: Date.now(),
  }
}

async function persistMoviesSnapshot(active: PlaylistEntity, result: MoviesCatalogResult): Promise<void> {
  await putCatalogSnapshot({
    kind: 'movies',
    playlistId: active.id,
    playlistUpdatedAt: active.updatedAt,
    sourceType: result.sourceType,
    cachedAtMs: Date.now(),
    payload: result,
  })
}

function scheduleMoviesBackgroundRevalidate(active: PlaylistEntity, revisionKey: string): void {
  const id = active.id
  // Cancelar revalidação anterior para esta playlist
  moviesRevalidateAbort.get(id)?.abort()
  const ac = new AbortController()
  moviesRevalidateAbort.set(id, ac)
  const gen = (moviesRevalidateGen.get(id) ?? 0) + 1
  moviesRevalidateGen.set(id, gen)
  const apiUrl = buildMoviesCatalogApiUrl(active)
  if (!apiUrl) return
  void (async () => {
    try {
      const result = await fetchMoviesCatalogFromBackend(apiUrl, ac.signal)
      if (ac.signal.aborted) return
      if (moviesRevalidateGen.get(id) !== gen) return
      const cur = playlistServiceGetActivePlaylist()
      if (!cur || cur.id !== id || cacheKey(cur) !== revisionKey) return
      result.meta = { playlistName: cur.name, playlistId: cur.id }
      memoryCache.set(id, { result, playlistRevision: revisionKey })
      await persistMoviesSnapshot(cur, result)
      dispatchCatalogRefresh({ kind: 'movies', playlistId: id, result })
    } catch {
      /* silencioso */
    } finally {
      if (moviesRevalidateAbort.get(id) === ac) moviesRevalidateAbort.delete(id)
    }
  })()
}

/**
 * Catálogo VOD (filmes) para a playlist activa — tenta API híbrida e cai para resolução no cliente.
 */
export async function getMoviesCatalogForActivePlaylist(options?: {
  forceRefresh?: boolean
  signal?: AbortSignal
}): Promise<MoviesCatalogResult> {
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
    const row = await getCatalogSnapshot('movies', active.id)
    if (row && catalogSnapshotMatchesPlaylist(row, active)) {
      const parsed = JSON.parse(JSON.stringify(row.payload)) as MoviesCatalogResult
      parsed.meta = { playlistName: active.name, playlistId: active.id }
      memoryCache.set(active.id, { result: parsed, playlistRevision: key })
      if (isCatalogSnapshotStale(row.cachedAtMs)) {
        scheduleMoviesBackgroundRevalidate(active, key)
      }
      return parsed
    }
  }

  const apiUrl = buildMoviesCatalogApiUrl(active)
  if (!apiUrl) {
    const result = emptyNoPlaylist()
    result.meta = { playlistName: active.name, playlistId: active.id }
    memoryCache.set(active.id, { result, playlistRevision: key })
    return result
  }

  let result: MoviesCatalogResult
  try {
    result = await fetchMoviesCatalogFromBackend(apiUrl, options?.signal)
  } catch {
    try {
      result = await resolveMoviesCatalogInClient()
    } catch {
      result = emptyNoPlaylist()
    }
  }

  result.meta = { playlistName: active.name, playlistId: active.id }
  memoryCache.set(active.id, { result, playlistRevision: key })
  void persistMoviesSnapshot(active, result)
  return result
}

export function moviesCatalogInvalidateCache(playlistId?: string): void {
  if (playlistId) {
    memoryCache.delete(playlistId)
    void deleteCatalogSnapshot('movies', playlistId)
  } else {
    memoryCache.clear()
    void deleteAllSnapshotsOfKind('movies')
  }
}

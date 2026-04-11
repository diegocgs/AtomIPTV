import { playlistServiceGetActivePlaylist } from '@/features/playlists/services/playlistService'
import {
  deleteAllSnapshotsOfKind,
  deleteCatalogSnapshot,
  getCatalogSnapshot,
  putCatalogSnapshot,
} from '@/lib/catalogSnapshotIdb'
import { dispatchCatalogRefresh } from '@/lib/catalogRefreshEvents'
import { catalogSnapshotMatchesPlaylist } from '@/lib/catalogWarmStart'
import type { LiveCatalogResult } from '../types/liveCatalog'
import type { PlaylistEntity } from '@/features/playlists/types/playlist'
import { parseM3u } from '@/services/m3u'
import {
  getM3uPlaylistBody,
  getM3uPlaylistLiveRows,
  liveRowsToM3uEntries,
  putM3uPlaylistBody,
} from '@/lib/m3uPlaylistCache'
import { filterM3uEntriesForLive } from '@/lib/m3uLive'
import { buildM3uDownloadRequestUrl } from '@/lib/m3uFetchUrl'
import { smartHttpGet } from '@/lib/proxyClientGet'
import {
  LIVE_ALL_CATEGORY_ID,
  LIVE_UNCATEGORIZED_ID,
  buildM3uCategoriesFromGroups,
  resolveM3uCategoryId,
  stableM3uChannelId,
} from '../utils/liveMappers'
import { buildHybridApiUrl } from '@/lib/hybridApiOrigin'
import {
  buildXtreamLiveStreamUrl,
  fetchXtreamLiveCategories,
  fetchXtreamLiveStreams,
  type XtreamCredentials,
} from '@/services/xtream'
import { filterXtreamLiveDataForTv } from '../utils/xtreamLiveTvFilter'

type CacheEntry = { result: LiveCatalogResult; playlistRevision: string; fetchedAt: number }

const memoryCache = new Map<string, CacheEntry>()
const inflightRequests = new Map<string, Promise<LiveCatalogResult>>()

const liveRevalidateGen = new Map<string, number>()

/** Não revalidar em background se o cache tem menos de 5 minutos. */
const REVALIDATE_STALE_MS = 5 * 60_000

function cacheKey(playlist: PlaylistEntity): string {
  return `${playlist.id}:${playlist.updatedAt}`
}

export function peekLiveCatalogMemoryCacheForActivePlaylist(): LiveCatalogResult | null {
  const active = playlistServiceGetActivePlaylist()
  if (!active) return null

  const hit = memoryCache.get(active.id)
  if (!hit) return null

  if (hit.playlistRevision !== cacheKey(active)) {
    return null
  }

  return hit.result
}

function emptyNoPlaylist(): LiveCatalogResult {
  return {
    categories: [],
    channels: [],
    sourceType: 'none',
    loadedAt: Date.now(),
  }
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

function buildCatalogApiUrl(active: PlaylistEntity): string | null {
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

  return buildHybridApiUrl('/api/live/catalog', qp)
}

async function fetchLiveCatalogFromBackend(url: string, signal?: AbortSignal): Promise<LiveCatalogResult> {
  const res = await fetch(url, { method: 'GET', signal })
  if (!res.ok) {
    const hint = await res.text().catch(() => '')
    throw new Error(`Live catalog API failed (${res.status})${hint ? `: ${hint.slice(0, 200)}` : ''}`)
  }
  const json = (await res.json()) as LiveCatalogResult
  return json
}

function credentialsFromXtreamEntity(active: PlaylistEntity & { type: 'xtream' }): XtreamCredentials {
  return {
    name: active.name,
    username: active.xtream.username,
    password: active.xtream.password,
    serverUrl: xtreamBaseFromEntity(active),
    port: active.xtream.port != null ? String(active.xtream.port) : undefined,
  }
}

function buildM3uLiveCatalogResult(
  entries: ReturnType<typeof filterM3uEntriesForLive>
): LiveCatalogResult {
  const hasUncategorized = entries.some((e) => !String(e.groupTitle ?? '').trim())
  const groups = entries.map((e) => String(e.groupTitle ?? '').trim()).filter(Boolean)
  const categories = buildM3uCategoriesFromGroups(groups, hasUncategorized)
  const channels = entries.map((e, index) => ({
    id: stableM3uChannelId(index, e.url, e.name),
    name: e.name,
    logo: String(e.tvgLogo ?? '').trim(),
    categoryId: resolveM3uCategoryId(e.groupTitle),
    streamUrl: e.url.trim(),
    sourceType: 'm3u' as const,
    originalSourceId: String(index),
    epgChannelId: e.tvgId ?? undefined,
    isLive: true as const,
    number: index + 1,
  }))
  return {
    categories,
    channels,
    sourceType: 'm3u',
    loadedAt: Date.now(),
  }
}

function sanitizeM3uLiveCatalogResult(result: LiveCatalogResult): LiveCatalogResult {
  if (result.sourceType !== 'm3u') return result

  const filteredEntries = filterM3uEntriesForLive(
    result.channels.map((channel) => ({
      name: channel.name,
      url: channel.streamUrl,
      groupTitle:
        result.categories.find((category) => category.id === channel.categoryId)?.name ?? '',
      tvgLogo: channel.logo,
      tvgId: channel.epgChannelId,
    })),
  )

  return buildM3uLiveCatalogResult(filteredEntries)
}

async function resolveLiveCatalogInClient(active: PlaylistEntity): Promise<LiveCatalogResult> {
  if (active.type === 'm3u') {
    const m3uUrl = m3uUrlFromEntity(active)
    if (!m3uUrl) return emptyNoPlaylist()

    // TV-first: priorizar catálogo fresco do M3U completo para evitar contagem congelada em cache compacto.
    // `liveRows` (snapshot filtrado) fica como último fallback offline.
    let body = await getM3uPlaylistBody(active.id, m3uUrl)
    if (!body) {
      try {
        const res = await smartHttpGet(buildM3uDownloadRequestUrl(m3uUrl), { method: 'GET' })
        if (!res.ok) throw new Error(`M3U fetch failed (${res.status})`)
        body = await res.text()
        void putM3uPlaylistBody(active.id, m3uUrl, body).catch(() => {})
      } catch {
        const liveRows = await getM3uPlaylistLiveRows(active.id, m3uUrl)
        if (liveRows && liveRows.length > 0) {
          return buildM3uLiveCatalogResult(filterM3uEntriesForLive(liveRowsToM3uEntries(liveRows)))
        }
        throw new Error('M3U fetch failed (no cached body/live rows)')
      }
    }
    return buildM3uLiveCatalogResult(filterM3uEntriesForLive(parseM3u(body)))
  }

  const credentials = credentialsFromXtreamEntity(active)
  const [catsRaw, streamsRaw] = await Promise.all([
    fetchXtreamLiveCategories(credentials),
    fetchXtreamLiveStreams(credentials),
  ])
  const { categories: cats, streams } = filterXtreamLiveDataForTv(catsRaw, streamsRaw)
  const known = new Set(cats.map((c) => String(c.category_id)))
  const categories = [
    { id: LIVE_ALL_CATEGORY_ID, name: 'Todos', order: 0 },
    ...cats.map((c, i) => ({
      id: `xt-cat:${String(c.category_id)}`,
      name: c.category_name,
      order: i + 1,
    })),
  ]
  if (streams.some((s) => !s.category_id || !known.has(String(s.category_id)))) {
    categories.push({ id: LIVE_UNCATEGORIZED_ID, name: 'Uncategorized', order: categories.length })
  }
  const channels = streams.map((s, index) => {
    const raw = s.category_id != null ? String(s.category_id) : ''
    return {
      id: `xtream-${s.stream_id}`,
      name: String(s.name ?? '').trim() || `Channel ${s.stream_id}`,
      logo: String(s.stream_icon ?? '').trim(),
      categoryId: raw && known.has(raw) ? `xt-cat:${raw}` : LIVE_UNCATEGORIZED_ID,
      streamUrl: buildXtreamLiveStreamUrl(credentials, s.stream_id),
      sourceType: 'xtream' as const,
      originalSourceId: String(s.stream_id),
      epgChannelId: s.epg_channel_id ?? undefined,
      isLive: true as const,
      number: index + 1,
    }
  })
  return {
    categories,
    channels,
    sourceType: 'xtream',
    loadedAt: Date.now(),
  }
}

async function persistLiveSnapshot(active: PlaylistEntity, result: LiveCatalogResult): Promise<void> {
  await putCatalogSnapshot({
    kind: 'live',
    playlistId: active.id,
    playlistUpdatedAt: active.updatedAt,
    sourceType: result.sourceType,
    cachedAtMs: Date.now(),
    payload: result,
  })
}

function scheduleLiveBackgroundRevalidate(active: PlaylistEntity, revisionKey: string): void {
  const id = active.id
  // Não revalidar se o cache em memória ainda é fresco.
  const cached = memoryCache.get(id)
  if (cached && cached.playlistRevision === revisionKey && Date.now() - cached.fetchedAt < REVALIDATE_STALE_MS) {
    return
  }
  const gen = (liveRevalidateGen.get(id) ?? 0) + 1
  liveRevalidateGen.set(id, gen)
  const apiUrl = buildCatalogApiUrl(active)
  if (!apiUrl) return
  void (async () => {
    try {
      const result = await fetchLiveCatalogFromBackend(apiUrl)
      if (liveRevalidateGen.get(id) !== gen) return
      const cur = playlistServiceGetActivePlaylist()
      if (!cur || cur.id !== id || cacheKey(cur) !== revisionKey) return
      result.meta = { playlistName: cur.name, playlistId: cur.id }
      memoryCache.set(id, { result, playlistRevision: revisionKey, fetchedAt: Date.now() })
      await persistLiveSnapshot(cur, result)
      dispatchCatalogRefresh({ kind: 'live', playlistId: id, result })
    } catch {
      /* revalidação silenciosa */
    }
  })()
}

/**
 * Catálogo Live TV para a playlist activa (M3U ou Xtream).
 */
export async function getLiveCatalogForActivePlaylist(options?: {
  /** Forçar ignorar cache em memória. */
  forceRefresh?: boolean
  /** Cancelar fetch/parse (ex.: StrictMode ou saída da página). */
  signal?: AbortSignal
}): Promise<LiveCatalogResult> {
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

    const inflight = inflightRequests.get(key)
    if (inflight) {
      return inflight
    }
  }

  if (!options?.forceRefresh) {
    const row = await getCatalogSnapshot('live', active.id)
    if (row && catalogSnapshotMatchesPlaylist(row, active)) {
      const parsed = JSON.parse(JSON.stringify(row.payload)) as LiveCatalogResult
      const sanitized = sanitizeM3uLiveCatalogResult(parsed)
      sanitized.meta = { playlistName: active.name, playlistId: active.id }
      memoryCache.set(active.id, { result: sanitized, playlistRevision: key, fetchedAt: Date.now() })
      // Sempre revalidar Live em background para evitar ficar preso em snapshot antigo de contagem.
      scheduleLiveBackgroundRevalidate(active, key)
      return sanitized
    }
  }

  const apiUrl = buildCatalogApiUrl(active)
  if (!apiUrl) {
    const result = emptyNoPlaylist()
    result.meta = { playlistName: active.name, playlistId: active.id }
    memoryCache.set(active.id, { result, playlistRevision: key, fetchedAt: Date.now() })
    return result
  }

  const request = (async (): Promise<LiveCatalogResult> => {
    let result: LiveCatalogResult
    let apiError: unknown = null
    try {
      result = await fetchLiveCatalogFromBackend(apiUrl, options?.signal)
    } catch (error) {
      apiError = error
      try {
        result = await resolveLiveCatalogInClient(active)
      } catch {
        throw apiError instanceof Error
          ? apiError
          : new Error('Erro ao carregar catálogo live.')
      }
    }

    result.meta = { playlistName: active.name, playlistId: active.id }
    const sanitized = sanitizeM3uLiveCatalogResult(result)
    sanitized.meta = { playlistName: active.name, playlistId: active.id }
    memoryCache.set(active.id, { result: sanitized, playlistRevision: key, fetchedAt: Date.now() })
    void persistLiveSnapshot(active, sanitized)
    return sanitized
  })()

  if (!options?.forceRefresh) {
    inflightRequests.set(key, request)
  }

  try {
    return await request
  } finally {
    if (!options?.forceRefresh) {
      const current = inflightRequests.get(key)
      if (current === request) {
        inflightRequests.delete(key)
      }
    }
  }
}

export function liveCatalogInvalidateCache(playlistId?: string): void {
  if (playlistId) {
    memoryCache.delete(playlistId)
    void deleteCatalogSnapshot('live', playlistId)
  } else {
    memoryCache.clear()
    void deleteAllSnapshotsOfKind('live')
  }
}

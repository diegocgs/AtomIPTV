import type { MoviesCatalogSourceKind } from '@/features/catalog/types/moviesCatalog'
import type { SeriesCatalogSourceKind } from '@/features/catalog/types/seriesCatalog'
import { playlistServiceGetActivePlaylist } from '@/features/playlists/services/playlistService'
import type { PlaylistEntity } from '@/features/playlists/types/playlist'
import { getXtreamCredentialsForApp } from '@/lib/playlistsStorage'
import {
  fetchXtreamSeriesInfo,
  fetchXtreamVodInfo,
  mergeXtreamVodInfoDetails,
  type XtreamVodInfoDetail,
} from '@/services/xtream'

const MOVIE_DETAIL_CACHE_PREFIX = 'iptv-movie-detail-v1:'
const movieDetailMemoryCache = new Map<string, XtreamVodInfoDetail | null>()

/**
 * Base da API híbrida. Se `VITE_HYBRID_API_BASE_URL` não estiver definido, usa a mesma origem
 * da app (`window.location.origin`) para bater em `/api/...` — o Vite/preview faz proxy para o Node.
 * Sem isto, em dev a URL era `null` e o detalhe VOD nunca ia à API.
 */
function hybridApiOrigin(): string | null {
  const base = (import.meta.env.VITE_HYBRID_API_BASE_URL as string | undefined)?.trim()
  if (base) return base.replace(/\/+$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '')
  }
  return null
}

/** Respostas às vezes vêm como `{ data: { plot, ... } }`. */
function unwrapFlatVodDetailJson(
  j: Record<string, unknown>,
): XtreamVodInfoDetail & { error?: string } {
  const plotTop = typeof j.plot === 'string' ? j.plot.trim() : ''
  const data = j.data
  if (plotTop || data == null || typeof data !== 'object' || Array.isArray(data)) {
    return j as unknown as XtreamVodInfoDetail & { error?: string }
  }
  const d = data as Record<string, unknown>
  const plotInner = typeof d.plot === 'string' ? d.plot.trim() : ''
  if (!plotInner && typeof d.description === 'string' && d.description.trim()) {
    return { ...d, ...j, plot: d.description } as unknown as XtreamVodInfoDetail & { error?: string }
  }
  if (plotInner) {
    return { ...d, ...j, plot: plotInner } as unknown as XtreamVodInfoDetail & { error?: string }
  }
  return j as unknown as XtreamVodInfoDetail & { error?: string }
}

function xtreamBaseFromEntity(p: PlaylistEntity & { type: 'xtream' }): string {
  if (p.resolution?.kind === 'xtream' && p.resolution.apiBaseUrl.trim()) {
    return p.resolution.apiBaseUrl.trim()
  }
  return p.xtream.server.trim()
}

function buildMoviesVodInfoHybridUrl(active: PlaylistEntity & { type: 'xtream' }, vodId: number): string | null {
  const origin = hybridApiOrigin()
  if (!origin) return null
  const baseUrl = xtreamBaseFromEntity(active)
  const username = active.xtream.username.trim()
  const password = active.xtream.password
  if (!baseUrl || !username || !password) return null
  const qp = new URLSearchParams({
    playlistId: active.id,
    playlistName: active.name,
    sourceType: 'xtream',
    baseUrl,
    username,
    password,
    vodId: String(vodId),
  })
  return `${origin}/api/vod/movies/info?${qp.toString()}`
}

function buildSeriesInfoHybridUrl(active: PlaylistEntity & { type: 'xtream' }, seriesId: number): string | null {
  const origin = hybridApiOrigin()
  if (!origin) return null
  const baseUrl = xtreamBaseFromEntity(active)
  const username = active.xtream.username.trim()
  const password = active.xtream.password
  if (!baseUrl || !username || !password) return null
  const qp = new URLSearchParams({
    playlistId: active.id,
    playlistName: active.name,
    sourceType: 'xtream',
    baseUrl,
    username,
    password,
    seriesId: String(seriesId),
  })
  return `${origin}/api/vod/series/info?${qp.toString()}`
}

function activePlaylistCacheKey(vodId: number): string | null {
  const active = playlistServiceGetActivePlaylist()
  if (!active) return null
  return `${active.id}:${vodId}`
}

function readMovieDetailCache(cacheKey: string): XtreamVodInfoDetail | null | undefined {
  if (movieDetailMemoryCache.has(cacheKey)) {
    return movieDetailMemoryCache.get(cacheKey) ?? null
  }
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(`${MOVIE_DETAIL_CACHE_PREFIX}${cacheKey}`)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { data?: XtreamVodInfoDetail | null } | null
    const data = parsed?.data ?? null
    movieDetailMemoryCache.set(cacheKey, data)
    return data
  } catch {
    return undefined
  }
}

function writeMovieDetailCache(cacheKey: string, data: XtreamVodInfoDetail | null): void {
  movieDetailMemoryCache.set(cacheKey, data)
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `${MOVIE_DETAIL_CACHE_PREFIX}${cacheKey}`,
      JSON.stringify({ cachedAtMs: Date.now(), data }),
    )
  } catch {
    /* best effort */
  }
}

export type SeriesDetailMeta = {
  plot: string
  genre: string
  rating: string
  year: number
  cover?: string
}

/** API híbrida primeiro em cada campo; painel no cliente só preenche o que faltar. */
function mergeSeriesDetailMeta(a: SeriesDetailMeta | null, b: SeriesDetailMeta | null): SeriesDetailMeta | null {
  if (!a) return b
  if (!b) return a
  const pick = (api: string, panel: string) => (api?.trim() ? api : panel) || ''
  const ay = a.year
  const yearOk = typeof ay === 'number' && ay >= 1900 && ay <= 2100
  const year = yearOk ? ay : b.year
  return {
    plot: pick(a.plot, b.plot),
    genre: pick(a.genre, b.genre),
    rating: pick(a.rating, b.rating),
    year,
    cover: a.cover?.trim() ? a.cover : b.cover,
  }
}

/**
 * Fonte principal: API híbrida `GET /api/vod/movies/info` (Node → `get_vod_info` no painel).
 * Complemento: `get_vod_info` no browser em paralelo quando houver credenciais; o merge prioriza a API.
 */
export async function enrichXtreamMovieDetail(
  vodId: number,
  sourceType: MoviesCatalogSourceKind,
  signal?: AbortSignal,
): Promise<XtreamVodInfoDetail | null> {
  if (sourceType !== 'xtream') return null

  const cacheKey = activePlaylistCacheKey(vodId)
  if (cacheKey) {
    const cached = readMovieDetailCache(cacheKey)
    if (cached !== undefined) return cached
  }

  try {
    const active = playlistServiceGetActivePlaylist()
    const hybridUrl =
      active?.type === 'xtream' ? buildMoviesVodInfoHybridUrl(active, vodId) : null
    const creds = getXtreamCredentialsForApp()
    const canDirect = Boolean(creds.serverUrl?.trim() && creds.username?.trim())

    const hybridP: Promise<XtreamVodInfoDetail | null> = hybridUrl
      ? fetch(hybridUrl, { method: 'GET', signal })
          .then(async (res) => {
            if (!res.ok) return null
            const raw = (await res.json()) as Record<string, unknown>
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
            if (raw.error != null && raw.error !== '') return null
            return unwrapFlatVodDetailJson(raw)
          })
          .catch(() => null)
      : Promise.resolve(null)

    const clientP: Promise<XtreamVodInfoDetail | null> = canDirect
      ? fetchXtreamVodInfo(creds, vodId).catch(() => null)
      : Promise.resolve(null)

    const [fromHybrid, fromClient] = await Promise.all([hybridP, clientP])
    const merged = mergeXtreamVodInfoDetails(fromHybrid, fromClient)
    if (cacheKey) writeMovieDetailCache(cacheKey, merged)
    return merged
  } catch {
    return null
  }
}

export async function prefetchXtreamMovieDetails(
  vodIds: readonly number[],
  sourceType: MoviesCatalogSourceKind,
  signal?: AbortSignal,
): Promise<void> {
  if (sourceType !== 'xtream') return
  const unique = Array.from(new Set(vodIds.filter((id) => Number.isFinite(id))))
  if (unique.length === 0) return

  const concurrency = 6
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < unique.length) {
      if (signal?.aborted) return
      const vodId = unique[cursor]
      cursor += 1
      if (vodId == null) continue
      try {
        await enrichXtreamMovieDetail(vodId, sourceType, signal)
      } catch {
        /* ignore prefetch failures */
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, () => worker()))
}

/**
 * Fonte principal: API híbrida `GET /api/vod/series/info`.
 * Complemento: `get_series_info` no browser em paralelo quando houver credenciais; o merge prioriza a API.
 */
export async function enrichXtreamSeriesDetail(
  seriesId: number,
  sourceType: SeriesCatalogSourceKind,
  signal?: AbortSignal,
): Promise<SeriesDetailMeta | null> {
  if (sourceType !== 'xtream') return null

  try {
    const active = playlistServiceGetActivePlaylist()
    const hybridUrl =
      active?.type === 'xtream' ? buildSeriesInfoHybridUrl(active, seriesId) : null
    const creds = getXtreamCredentialsForApp()
    const canDirect = Boolean(creds.serverUrl?.trim() && creds.username?.trim())

    const hybridP: Promise<SeriesDetailMeta | null> = hybridUrl
      ? fetch(hybridUrl, { method: 'GET', signal })
          .then(async (res) => {
            if (!res.ok) return null
            const j = (await res.json()) as SeriesDetailMeta & { error?: string }
            if (j && typeof j === 'object' && !Array.isArray(j) && j.error == null) return j
            return null
          })
          .catch(() => null)
      : Promise.resolve(null)

    const clientP: Promise<SeriesDetailMeta | null> = canDirect
      ? fetchXtreamSeriesInfo(creds, seriesId)
          .then((full) => ({
            plot: full.plot,
            genre: full.genre,
            rating: full.rating,
            year: full.year,
            cover: full.cover,
          }))
          .catch(() => null)
      : Promise.resolve(null)

    const [fromHybrid, fromClient] = await Promise.all([hybridP, clientP])
    return mergeSeriesDetailMeta(fromHybrid, fromClient)
  } catch {
    return null
  }
}

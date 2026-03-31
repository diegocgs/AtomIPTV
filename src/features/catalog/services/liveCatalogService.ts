import { playlistServiceGetActivePlaylist } from '@/features/playlists/services/playlistService'
import type { LiveCatalogResult } from '../types/liveCatalog'
import type { PlaylistEntity } from '@/features/playlists/types/playlist'

type CacheEntry = { result: LiveCatalogResult; playlistRevision: string }

const memoryCache = new Map<string, CacheEntry>()

function cacheKey(playlist: PlaylistEntity): string {
  return `${playlist.id}:${playlist.updatedAt}`
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

  const base = (import.meta.env.VITE_HYBRID_API_BASE_URL as string | undefined)?.trim()
  const origin = base && base.length > 0 ? base.replace(/\/+$/, '') : ''
  return `${origin}/api/live/catalog?${qp.toString()}`
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
  }

  const apiUrl = buildCatalogApiUrl(active)
  if (!apiUrl) {
    const result = emptyNoPlaylist()
    result.meta = { playlistName: active.name, playlistId: active.id }
    memoryCache.set(active.id, { result, playlistRevision: key })
    return result
  }

  const result = await fetchLiveCatalogFromBackend(apiUrl, options?.signal)

  result.meta = { playlistName: active.name, playlistId: active.id }
  memoryCache.set(active.id, { result, playlistRevision: key })
  return result
}

export function liveCatalogInvalidateCache(playlistId?: string): void {
  if (playlistId) memoryCache.delete(playlistId)
  else memoryCache.clear()
}

import { DEFAULT_PLAYLIST_ID } from '@/lib/favorites'
import type { XtreamCredentials } from '@/services/xtream'
import { playlistServiceGetSnapshot } from '@/features/playlists/services/playlistService'
import type { PlaylistEntity } from '@/features/playlists/types/playlist'
import { getM3uPlaylistLiveRows } from '@/lib/m3uPlaylistCache'
import { buildM3uDownloadRequestUrl } from '@/lib/m3uFetchUrl'
import { smartHttpGet } from '@/lib/proxyClientGet'

export const PLAYLISTS_STORAGE_KEY = 'iptv_samsung.playlists.v1'
export const PLAYLISTS_CHANGED_EVENT = 'iptv-playlists-storage-changed'

export type StoredPlaylistXtream = {
  id: string
  kind: 'xtream'
  displayName: string
  username: string
  password: string
  serverUrl: string
  createdAt: number
}

export type StoredPlaylistM3u = {
  id: string
  kind: 'm3u'
  displayName: string
  m3uUrl: string
  createdAt: number
}

export type StoredPlaylist = StoredPlaylistXtream | StoredPlaylistM3u

export type PlaylistsPersistedState = {
  playlists: StoredPlaylist[]
  activeId: string | null
}

function mapEntityToStored(entity: PlaylistEntity): StoredPlaylist {
  if (entity.type === 'xtream') {
    return {
      id: entity.id,
      kind: 'xtream',
      displayName: entity.name,
      username: entity.xtream.username,
      password: entity.xtream.password,
      serverUrl:
        entity.resolution?.kind === 'xtream'
          ? entity.resolution.apiBaseUrl
          : entity.xtream.server,
      createdAt: entity.createdAt,
    }
  }
  return {
    id: entity.id,
    kind: 'm3u',
    displayName: entity.name,
    m3uUrl:
      entity.resolution?.kind === 'm3u'
        ? entity.resolution.playlistUrl
        : entity.m3u.url,
    createdAt: entity.createdAt,
  }
}

export function loadPlaylistsState(): PlaylistsPersistedState {
  const snap = playlistServiceGetSnapshot()
  return {
    playlists: snap.playlists.map(mapEntityToStored),
    activeId: snap.activePlaylistId,
  }
}

/**
 * Tenta extrair credenciais Xtream de um URL de stream.
 * Suporta múltiplos formatos de URL comuns em providers IPTV:
 *  - `/live/{username}/{password}/{stream_id}[.ext]`
 *  - `/movie/{username}/{password}/{stream_id}[.ext]`
 *  - `/series/{username}/{password}/{stream_id}[.ext]`
 *  - `get.php?username=X&password=Y` (apanha também via query params)
 */
export function tryDeriveXtreamFromStreamUrl(
  streamUrl: string,
  displayName: string,
): XtreamCredentials | null {
  try {
    const u = new URL(streamUrl)
    // Formato: /live|movie|series/{username}/{password}/{stream_id}
    const XTREAM_SECTIONS = new Set(['live', 'movie', 'movies', 'series', 'serie', 'vod'])
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length >= 3 && XTREAM_SECTIONS.has(parts[0].toLowerCase())) {
      const username = parts[1]
      const password = parts[2]
      if (username && password && !/^\d+$/.test(username)) {
        // username não pode ser só números (seria um stream_id)
        return { name: displayName, username, password, serverUrl: u.origin }
      }
    }
    // Formato: get.php?username=X&password=Y (já coberto por tryDeriveXtreamFromM3uUrl,
    // mas adicionado aqui para uniformidade)
    const username = u.searchParams.get('username')?.trim()
    const password = u.searchParams.get('password')?.trim()
    if (username && password) {
      return { name: displayName, username, password, serverUrl: u.origin }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Varre linhas de texto M3U (até `limit` linhas) à procura de credenciais Xtream.
 * Usado tanto para cache como para download on-demand.
 */
export function tryDeriveXtreamCredsFromM3uText(
  text: string,
  displayName: string,
  limit = 600,
): XtreamCredentials | null {
  const lines = text.split('\n')
  for (const line of lines.slice(0, limit)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const creds = tryDeriveXtreamFromStreamUrl(trimmed, displayName)
    if (creds) return creds
  }
  return null
}

/**
 * Tenta derivar credenciais Xtream de uma playlist M3U a partir dos URLs de stream
 * guardados em cache (IndexedDB). Usado quando o URL da playlist é um shortlink
 * e `tryDeriveXtreamFromM3uUrl` não consegue extrair credenciais.
 */
export async function tryDeriveXtreamCredentialsFromM3uCacheAsync(
  playlistId: string,
  m3uUrl: string,
  displayName: string,
): Promise<XtreamCredentials | null> {
  try {
    const rows = await getM3uPlaylistLiveRows(playlistId, m3uUrl)
    if (!rows || rows.length === 0) return null
    for (const row of rows.slice(0, 20)) {
      const creds = tryDeriveXtreamFromStreamUrl(row.u, displayName)
      if (creds) return creds
    }
    return null
  } catch {
    return null
  }
}

/**
 * Fallback final: descarrega o M3U on-demand e varre as primeiras linhas à procura
 * de credenciais Xtream. Usado quando o cache ainda está vazio (primeira abertura).
 * Percorre no máximo 600 linhas para evitar ler ficheiros enormes na íntegra.
 */
export async function tryDeriveXtreamCredentialsFromM3uFetchAsync(
  m3uUrl: string,
  displayName: string,
): Promise<XtreamCredentials | null> {
  try {
    const downloadUrl = buildM3uDownloadRequestUrl(m3uUrl)
    const res = await smartHttpGet(downloadUrl, { method: 'GET' })
    if (!res.ok) return null
    const text = await res.text()
    return tryDeriveXtreamCredsFromM3uText(text, displayName)
  } catch {
    return null
  }
}

function tryDeriveXtreamFromM3uUrl(p: StoredPlaylistM3u): XtreamCredentials | null {
  const raw = p.m3uUrl.trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    const username = u.searchParams.get('username') ?? ''
    const password = u.searchParams.get('password') ?? ''
    if (!username.trim() || !password.trim()) return null
    return {
      name: p.displayName,
      username,
      password,
      serverUrl: u.origin,
    }
  } catch {
    return null
  }
}

export function deriveXtreamCredentialsFromM3uPlaylist(
  p: StoredPlaylistM3u,
): XtreamCredentials | null {
  return tryDeriveXtreamFromM3uUrl(p)
}

const NO_XTREAM_CREDENTIALS: XtreamCredentials = {
  name: 'No Xtream playlist',
  username: '',
  password: '',
  serverUrl: '',
}

export function storedXtreamToCredentials(
  p: StoredPlaylistXtream,
): XtreamCredentials {
  return {
    name: p.displayName,
    username: p.username,
    password: p.password,
    serverUrl: p.serverUrl,
  }
}

export function getXtreamCredentialsForApp(): XtreamCredentials {
  const state = loadPlaylistsState()
  if (!state.activeId) return NO_XTREAM_CREDENTIALS
  const active = state.playlists.find((p) => p.id === state.activeId)
  if (!active) return NO_XTREAM_CREDENTIALS
  if (active.kind === 'xtream') return storedXtreamToCredentials(active)
  return deriveXtreamCredentialsFromM3uPlaylist(active) ?? NO_XTREAM_CREDENTIALS
}

export function getActivePlaylistIdForFavorites(): string {
  const state = loadPlaylistsState()
  return state.activeId ?? DEFAULT_PLAYLIST_ID
}

export function getActivePlaylistDisplayName(): string {
  const state = loadPlaylistsState()
  if (!state.activeId) return getXtreamCredentialsForApp().name
  const active = state.playlists.find((p) => p.id === state.activeId)
  return active?.displayName ?? getXtreamCredentialsForApp().name
}

/**
 * Versão assíncrona de `getXtreamCredentialsForApp()`.
 * Quando a playlist M3U é um shortlink (sem credenciais na URL), tenta derivar
 * credenciais a partir dos URLs de stream cacheados no IndexedDB ou, como
 * fallback final, descarregando o M3U.
 */
export async function getXtreamCredentialsForAppAsync(): Promise<XtreamCredentials> {
  const sync = getXtreamCredentialsForApp()
  if (sync.serverUrl && sync.username) return sync

  // Fallback assíncrono para playlists M3U shortlink
  const state = loadPlaylistsState()
  if (!state.activeId) return NO_XTREAM_CREDENTIALS
  const active = state.playlists.find((p) => p.id === state.activeId)
  if (!active || active.kind !== 'm3u') return NO_XTREAM_CREDENTIALS

  // 1) Tentar do cache IndexedDB (stream URLs já descarregados)
  const fromCache = await tryDeriveXtreamCredentialsFromM3uCacheAsync(
    active.id,
    active.m3uUrl,
    active.displayName,
  )
  if (fromCache) return fromCache

  // 2) Fallback: descarregar o M3U e varrer as primeiras linhas
  const fromFetch = await tryDeriveXtreamCredentialsFromM3uFetchAsync(
    active.m3uUrl,
    active.displayName,
  )
  if (fromFetch) return fromFetch

  return NO_XTREAM_CREDENTIALS
}

export function shouldUseXtreamApiForActivePlaylist(): boolean {
  const c = getXtreamCredentialsForApp()
  return Boolean(c.serverUrl && c.username && c.password)
}

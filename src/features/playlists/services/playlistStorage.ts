import type { PlaylistEntity, PlaylistStatus, PlaylistType } from '../types/playlist'

const STORAGE_KEY = 'iptv_samsung.playlists.v1'
const CHANGED_EVENT = 'iptv-playlists-storage-changed'

export const PLAYLIST_STORAGE_CHANGED_EVENT = CHANGED_EVENT

type PersistedM3U = { url: string }
type PersistedXtream = {
  server: string
  username: string
  password: string
  port?: number
  useHttps?: boolean
}

type PersistedRow = {
  id: string
  name: string
  type: PlaylistType
  createdAt: number
  updatedAt: number
  lastValidatedAt?: number
  status: PlaylistStatus
  errorMessage?: string
  m3u?: PersistedM3U
  xtream?: PersistedXtream
  resolution?: PlaylistEntity['resolution']
}

interface PersistedFileV1 {
  version: 1
  activePlaylistId: string | null
  playlists: PersistedRow[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function parseStored(json: string | null): PersistedFileV1 | null {
  if (!json) return null
  let data: unknown
  try {
    data = JSON.parse(json) as unknown
  } catch {
    return null
  }
  if (!isRecord(data)) return null
  if (data.version !== 1) return null
  if (!Array.isArray(data.playlists)) return null
  const activePlaylistId =
    data.activePlaylistId === null || typeof data.activePlaylistId === 'string'
      ? (data.activePlaylistId as string | null)
      : null
  const playlists: PersistedRow[] = []
  for (const row of data.playlists) {
    if (!isRecord(row)) continue
    if (typeof row.id !== 'string' || typeof row.name !== 'string') continue
    if (row.type !== 'm3u' && row.type !== 'xtream') continue
    const base = {
      id: row.id,
      name: row.name,
      type: row.type,
      createdAt: typeof row.createdAt === 'number' ? row.createdAt : Date.now(),
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : Date.now(),
      lastValidatedAt: typeof row.lastValidatedAt === 'number' ? row.lastValidatedAt : undefined,
      status: (['idle', 'validating', 'ready', 'error'].includes(String(row.status))
        ? row.status
        : 'ready') as PlaylistStatus,
      errorMessage: typeof row.errorMessage === 'string' ? row.errorMessage : undefined,
      resolution: row.resolution as PersistedRow['resolution'],
    }
    if (row.type === 'm3u' && isRecord(row.m3u) && typeof row.m3u.url === 'string') {
      playlists.push({
        ...base,
        type: 'm3u',
        m3u: { url: row.m3u.url },
      })
      continue
    }
    if (
      row.type === 'xtream' &&
      isRecord(row.xtream) &&
      typeof row.xtream.server === 'string' &&
      typeof row.xtream.username === 'string' &&
      typeof row.xtream.password === 'string'
    ) {
      playlists.push({
        ...base,
        type: 'xtream',
        xtream: {
          server: row.xtream.server,
          username: row.xtream.username,
          password: row.xtream.password,
          port: typeof row.xtream.port === 'number' ? row.xtream.port : undefined,
          useHttps: typeof row.xtream.useHttps === 'boolean' ? row.xtream.useHttps : undefined,
        },
      })
    }
  }
  return { version: 1, activePlaylistId, playlists }
}

function rowToEntity(row: PersistedRow, activeId: string | null): PlaylistEntity {
  const base = {
    id: row.id,
    name: row.name,
    isActive: row.id === activeId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastValidatedAt: row.lastValidatedAt,
    status: row.status,
    errorMessage: row.errorMessage,
    resolution: row.resolution,
  }
  if (row.type === 'm3u' && row.m3u) {
    return { ...base, type: 'm3u', m3u: row.m3u }
  }
  return {
    ...base,
    type: 'xtream',
    xtream: row.xtream ?? { server: '', username: '', password: '' },
  }
}

function entityToRow(e: PlaylistEntity): PersistedRow {
  const common = {
    id: e.id,
    name: e.name,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    lastValidatedAt: e.lastValidatedAt,
    status: e.status,
    errorMessage: e.errorMessage,
    resolution: e.resolution,
  }
  if (e.type === 'm3u') {
    return { ...common, type: 'm3u', m3u: { url: e.m3u.url } }
  }
  return {
    ...common,
    type: 'xtream',
    xtream: {
      server: e.xtream.server,
      username: e.xtream.username,
      password: e.xtream.password,
      port: e.xtream.port,
      useHttps: e.xtream.useHttps,
    },
  }
}

export type PlaylistStorageSnapshot = {
  playlists: PlaylistEntity[]
  activePlaylistId: string | null
}

function readFile(): PersistedFileV1 {
  if (typeof localStorage === 'undefined') {
    return { version: 1, activePlaylistId: null, playlists: [] }
  }
  const parsed = parseStored(localStorage.getItem(STORAGE_KEY))
  if (!parsed) return { version: 1, activePlaylistId: null, playlists: [] }
  return parsed
}

function writeFile(file: PersistedFileV1): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(file))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT))
  }
}

export function playlistStorageLoad(): PlaylistStorageSnapshot {
  const file = readFile()
  const activeId = file.activePlaylistId
  const playlists = file.playlists.map((row) => rowToEntity(row, activeId))
  return { playlists, activePlaylistId: activeId }
}

export function playlistStorageSave(snapshot: PlaylistStorageSnapshot): void {
  const activeId = snapshot.activePlaylistId
  const rows = snapshot.playlists.map((e) => {
    const row = entityToRow({ ...e, isActive: e.id === activeId })
    return row
  })
  writeFile({ version: 1, activePlaylistId: activeId, playlists: rows })
}

export function playlistStorageSubscribe(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const fn = () => listener()
  window.addEventListener(CHANGED_EVENT, fn)
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) listener()
  })
  return () => {
    window.removeEventListener(CHANGED_EVENT, fn)
  }
}

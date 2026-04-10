import { onPlaylistDeleted } from '@/lib/catalogPlaylistLifecycle'
import type { PlaylistFormPayload, PlaylistCommitResult } from '../types/form'
import type { PlaylistEntity } from '../types/playlist'
import { resolveM3UPlaylist } from './m3uResolver'
import { resolveXtreamPlaylist } from './xtreamResolver'
import { validateM3UInput, validateXtreamInput } from './playlistValidation'
import {
  playlistStorageLoad,
  playlistStorageSave,
  type PlaylistStorageSnapshot,
} from './playlistStorage'

type SeedPlaylist =
  | { kind: 'm3u'; name: string; url: string }
  | { kind: 'xtream'; name: string; server: string; username: string; password: string }

const DEFAULT_SEED_PLAYLISTS: SeedPlaylist[] = [
  {
    kind: 'xtream',
    name: 'Canada',
    username: 'Diego9499',
    password: '1AWXAZW832',
    server: 'http://mtvlive.asia',
  },
  {
    kind: 'm3u',
    name: 'Brasil M3U',
    url: 'https://2836.short.gy/artik2',
  },
  {
    kind: 'xtream',
    name: 'Brasil',
    username: '2nsrgtjfuxy',
    password: 'a45mpju7vhy',
    server: 'http://assistirpainel.info:8880',
  },
  {
    kind: 'xtream',
    name: 'Brasil Xtream',
    username: '2nsrgtjfuxy',
    password: 'a45mpju7vhy',
    server: 'http://assistirpainel.info:8880',
  },
]

function hasValidM3uConfig(entity: PlaylistEntity & { type: 'm3u' }): boolean {
  const url =
    entity.resolution?.kind === 'm3u' && entity.resolution.playlistUrl.trim()
      ? entity.resolution.playlistUrl.trim()
      : entity.m3u.url.trim()
  return url.length > 0
}

function hasValidXtreamConfig(entity: PlaylistEntity & { type: 'xtream' }): boolean {
  const server =
    entity.resolution?.kind === 'xtream' && entity.resolution.apiBaseUrl.trim()
      ? entity.resolution.apiBaseUrl.trim()
      : entity.xtream.server.trim()
  return (
    server.length > 0 &&
    entity.xtream.username.trim().length > 0 &&
    entity.xtream.password.trim().length > 0
  )
}

function isPlaylistUsable(entity: PlaylistEntity): boolean {
  return entity.type === 'm3u' ? hasValidM3uConfig(entity) : hasValidXtreamConfig(entity)
}

function sanitizeSnapshot(snapshot: PlaylistStorageSnapshot): PlaylistStorageSnapshot {
  const playlists = snapshot.playlists.filter(isPlaylistUsable)
  const activePlaylistId =
    snapshot.activePlaylistId && playlists.some((playlist) => playlist.id === snapshot.activePlaylistId)
      ? snapshot.activePlaylistId
      : (playlists[0]?.id ?? null)

  return { playlists, activePlaylistId }
}

function saveSanitizedSnapshotIfNeeded(snapshot: PlaylistStorageSnapshot): PlaylistStorageSnapshot {
  const sanitized = sanitizeSnapshot(snapshot)
  const changed =
    sanitized.activePlaylistId !== snapshot.activePlaylistId ||
    sanitized.playlists.length !== snapshot.playlists.length ||
    sanitized.playlists.some((playlist, index) => snapshot.playlists[index]?.id !== playlist.id)

  if (changed) {
    playlistStorageSave(sanitized)
  }

  return sanitized
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function now(): number {
  return Date.now()
}

function buildEntityFromSeed(item: SeedPlaylist, t: number): PlaylistEntity {
  if (item.kind === 'm3u') {
    const { config, resolution } = resolveM3UPlaylist(item.url)
    return {
      id: newId(),
      name: item.name,
      type: 'm3u',
      isActive: false,
      createdAt: t,
      updatedAt: t,
      lastValidatedAt: t,
      status: 'ready',
      m3u: config,
      resolution,
    }
  }
  const resolved = resolveXtreamPlaylist({
    serverRaw: item.server,
    username: item.username,
    password: item.password,
  })
  return {
    id: newId(),
    name: item.name,
    type: 'xtream',
    isActive: false,
    createdAt: t,
    updatedAt: t,
    lastValidatedAt: t,
    status: 'ready',
    xtream: resolved.config,
    resolution: resolved.resolution,
  }
}

/** Verifica se um seed já existe na lista (por nome exacto). */
function seedAlreadyExists(item: SeedPlaylist, playlists: PlaylistEntity[]): boolean {
  return playlists.some((p) => p.name.trim().toLowerCase() === item.name.trim().toLowerCase())
}

/**
 * Seed de playlists padrão.
 * - Se não existem playlists: injeta todas.
 * - Se já existem playlists: injeta apenas as que ainda não existam (por nome).
 *   Garante que novas entradas do seed chegam a utilizadores com dados existentes.
 */
export function playlistServiceEnsureDefaultSeeds(): void {
  const snap = saveSanitizedSnapshotIfNeeded(playlistStorageLoad())
  const baseTs = now()

  if (snap.playlists.length === 0) {
    const seeded: PlaylistEntity[] = DEFAULT_SEED_PLAYLISTS.map((item, idx) =>
      buildEntityFromSeed(item, baseTs + idx),
    )
    playlistStorageSave({
      playlists: seeded,
      activePlaylistId: seeded[0]?.id ?? null,
    })
    return
  }

  // Injetar apenas seeds em falta (novas entradas adicionadas ao DEFAULT_SEED_PLAYLISTS)
  const missing = DEFAULT_SEED_PLAYLISTS.filter((item) => !seedAlreadyExists(item, snap.playlists))
  if (missing.length === 0) return

  const newEntities = missing.map((item, idx) => buildEntityFromSeed(item, baseTs + idx))
  playlistStorageSave({
    playlists: [...snap.playlists, ...newEntities],
    activePlaylistId: snap.activePlaylistId,
  })
}

export function playlistServiceGetSnapshot(): PlaylistStorageSnapshot {
  playlistServiceEnsureDefaultSeeds()
  return saveSanitizedSnapshotIfNeeded(playlistStorageLoad())
}

/**
 * Submissão do modal Add/Edit: valida, resolve, persiste.
 * Em `add`, por omissão a nova playlist fica ativa (comportamento alinhado à UI anterior).
 */
export function playlistServiceSubmitForm(
  payload: PlaylistFormPayload,
  options?: { makeActiveOnAdd?: boolean },
): PlaylistCommitResult {
  const makeActiveOnAdd = options?.makeActiveOnAdd !== false
  const snap = playlistStorageLoad()

  if (payload.mode === 'add') {
    if (payload.kind === 'm3u') {
      const v = validateM3UInput(payload.name, payload.url)
      if (!v.ok) return { ok: false, error: v.message }
      const normUrl = payload.url.trim().toLowerCase()
      const dup = snap.playlists.find(
        (p) => p.type === 'm3u' && p.m3u.url.trim().toLowerCase() === normUrl,
      )
      if (dup) return { ok: false, error: `Já existe uma playlist com este URL ("${dup.name}").` }
      const { config, resolution } = resolveM3UPlaylist(payload.url)
      const t = now()
      const entity: PlaylistEntity = {
        id: newId(),
        name: payload.name.trim(),
        type: 'm3u',
        isActive: false,
        createdAt: t,
        updatedAt: t,
        lastValidatedAt: t,
        status: 'ready',
        m3u: config,
        resolution,
      }
      const playlists = [...snap.playlists, entity]
      const activePlaylistId = makeActiveOnAdd ? entity.id : snap.activePlaylistId
      playlistStorageSave({ playlists, activePlaylistId })
      return { ok: true }
    }

    const v = validateXtreamInput(payload.name, payload.server, payload.username, payload.password)
    if (!v.ok) return { ok: false, error: v.message }
    const normServer = payload.server.trim().toLowerCase()
    const normUser = payload.username.trim().toLowerCase()
    const dup = snap.playlists.find(
      (p) =>
        p.type === 'xtream' &&
        p.xtream.server.trim().toLowerCase() === normServer &&
        p.xtream.username.trim().toLowerCase() === normUser,
    )
    if (dup) return { ok: false, error: `Já existe uma playlist com este servidor e utilizador ("${dup.name}").` }
    let resolved: ReturnType<typeof resolveXtreamPlaylist>
    try {
      resolved = resolveXtreamPlaylist({
        serverRaw: payload.server,
        username: payload.username,
        password: payload.password,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid server URL'
      return { ok: false, error: msg }
    }
    const t = now()
    const entity: PlaylistEntity = {
      id: newId(),
      name: payload.name.trim(),
      type: 'xtream',
      isActive: false,
      createdAt: t,
      updatedAt: t,
      lastValidatedAt: t,
      status: 'ready',
      xtream: resolved.config,
      resolution: resolved.resolution,
    }
    const playlists = [...snap.playlists, entity]
    const activePlaylistId = makeActiveOnAdd ? entity.id : snap.activePlaylistId
    playlistStorageSave({ playlists, activePlaylistId })
    return { ok: true }
  }

  const prev = snap.playlists.find((p) => p.id === payload.id)
  if (!prev) return { ok: false, error: 'Playlist not found' }

  if (payload.kind === 'm3u') {
    const v = validateM3UInput(payload.name, payload.url)
    if (!v.ok) return { ok: false, error: v.message }
    const { config, resolution } = resolveM3UPlaylist(payload.url)
    const t = now()
    const updated: PlaylistEntity = {
      id: prev.id,
      name: payload.name.trim(),
      type: 'm3u',
      isActive: prev.isActive,
      createdAt: prev.createdAt,
      updatedAt: t,
      lastValidatedAt: t,
      status: 'ready',
      errorMessage: undefined,
      m3u: config,
      resolution,
    }
    const playlists = snap.playlists.map((p) => (p.id === payload.id ? updated : p))
    playlistStorageSave({ playlists, activePlaylistId: snap.activePlaylistId })
    return { ok: true }
  }

  const v = validateXtreamInput(payload.name, payload.server, payload.username, payload.password)
  if (!v.ok) return { ok: false, error: v.message }
  let resolved: ReturnType<typeof resolveXtreamPlaylist>
  try {
    resolved = resolveXtreamPlaylist({
      serverRaw: payload.server,
      username: payload.username,
      password: payload.password,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid server URL'
    return { ok: false, error: msg }
  }
  const t = now()
  const updated: PlaylistEntity = {
    id: prev.id,
    name: payload.name.trim(),
    type: 'xtream',
    isActive: prev.isActive,
    createdAt: prev.createdAt,
    updatedAt: t,
    lastValidatedAt: t,
    status: 'ready',
    errorMessage: undefined,
    xtream: resolved.config,
    resolution: resolved.resolution,
  }
  const playlists = snap.playlists.map((p) => (p.id === payload.id ? updated : p))
  playlistStorageSave({ playlists, activePlaylistId: snap.activePlaylistId })
  return { ok: true }
}

export function playlistServiceSetActivePlaylist(id: string | null): PlaylistCommitResult {
  const snap = saveSanitizedSnapshotIfNeeded(playlistStorageLoad())
  if (id !== null && !snap.playlists.some((p) => p.id === id)) {
    return { ok: false, error: 'Playlist not found' }
  }
  playlistStorageSave({ playlists: snap.playlists, activePlaylistId: id })
  return { ok: true }
}

export function playlistServiceDeletePlaylist(id: string): void {
  const snap = saveSanitizedSnapshotIfNeeded(playlistStorageLoad())
  const filtered = snap.playlists.filter((p) => p.id !== id)
  let activePlaylistId = snap.activePlaylistId
  if (activePlaylistId === id) {
    activePlaylistId = filtered[0]?.id ?? null
  }
  playlistStorageSave({ playlists: filtered, activePlaylistId })
  onPlaylistDeleted(id)
}

export function playlistServiceGetById(id: string): PlaylistEntity | undefined {
  return saveSanitizedSnapshotIfNeeded(playlistStorageLoad()).playlists.find((p) => p.id === id)
}

export function playlistServiceGetActivePlaylist(): PlaylistEntity | null {
  const snap = saveSanitizedSnapshotIfNeeded(playlistStorageLoad())
  if (!snap.activePlaylistId) return null
  return snap.playlists.find((p) => p.id === snap.activePlaylistId) ?? null
}

/**
 * Estado leve de navegação Live TV (última categoria / canal por playlist).
 * localStorage: pequeno, sem grandes payloads.
 */

const STORAGE_KEY = 'iptv_samsung.ux.liveNav.v1'

type LiveNavEntry = {
  categoryIndex: number
  channelId: string | null
}

type FileV1 = {
  version: 1
  byPlaylist: Record<string, LiveNavEntry>
}

function readFile(): FileV1 {
  if (typeof window === 'undefined') return { version: 1, byPlaylist: {} }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 1, byPlaylist: {} }
    const p = JSON.parse(raw) as unknown
    if (typeof p !== 'object' || p === null || (p as FileV1).version !== 1) {
      return { version: 1, byPlaylist: {} }
    }
    const byPlaylist = (p as FileV1).byPlaylist
    if (typeof byPlaylist !== 'object' || byPlaylist === null) {
      return { version: 1, byPlaylist: {} }
    }
    return { version: 1, byPlaylist: { ...byPlaylist } }
  } catch {
    return { version: 1, byPlaylist: {} }
  }
}

function writeFile(f: FileV1): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(f))
  } catch {
    /* quota */
  }
}

export function getLiveNavForPlaylist(playlistId: string): LiveNavEntry | null {
  const f = readFile()
  const e = f.byPlaylist[playlistId]
  if (!e || typeof e.categoryIndex !== 'number') return null
  return {
    categoryIndex: e.categoryIndex,
    channelId: typeof e.channelId === 'string' || e.channelId === null ? e.channelId : null,
  }
}

export function setLiveNavForPlaylist(playlistId: string, entry: LiveNavEntry): void {
  const f = readFile()
  f.byPlaylist[playlistId] = {
    categoryIndex: Math.max(0, Math.floor(entry.categoryIndex)),
    channelId: entry.channelId,
  }
  writeFile(f)
}

export function clearLiveNavForPlaylist(playlistId: string): void {
  const f = readFile()
  delete f.byPlaylist[playlistId]
  writeFile(f)
}

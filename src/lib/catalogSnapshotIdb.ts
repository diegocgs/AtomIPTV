/**
 * Persistência de catálogos já resolvidos (Live / Movies / Series) em IndexedDB.
 * DB dedicado para não conflitar com a versão do cache M3U bruto.
 */

const DB_NAME = 'iptv-catalog-snapshots-v1'
const DB_VERSION = 1
const STORE = 'snapshots'

export type CatalogSnapshotKind = 'live' | 'movies' | 'series'

export type CatalogSnapshotRecord = {
  /** `${kind}:${playlistId}` */
  key: string
  kind: CatalogSnapshotKind
  playlistId: string
  playlistUpdatedAt: number
  sourceType: 'm3u' | 'xtream' | 'none'
  cachedAtMs: number
  /** Resultado serializável (JSON) do serviço de catálogo. */
  payload: unknown
}

function snapshotKey(kind: CatalogSnapshotKind, playlistId: string): string {
  return `${kind}:${playlistId}`
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('indexedDB unavailable'))
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = (): void => reject(req.error ?? new Error('catalog IDB open failed'))
    req.onsuccess = (): void => resolve(req.result)
    req.onupgradeneeded = (): void => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
  })
  return dbPromise
}

export async function getCatalogSnapshot(
  kind: CatalogSnapshotKind,
  playlistId: string
): Promise<CatalogSnapshotRecord | null> {
  try {
    const db = await openDb()
    const key = snapshotKey(kind, playlistId)
    return await new Promise<CatalogSnapshotRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = (): void => resolve((req.result as CatalogSnapshotRecord) ?? null)
      req.onerror = (): void => reject(req.error ?? new Error('catalog IDB get failed'))
    })
  } catch {
    return null
  }
}

export async function putCatalogSnapshot(record: Omit<CatalogSnapshotRecord, 'key'>): Promise<void> {
  const key = snapshotKey(record.kind, record.playlistId)
  const full: CatalogSnapshotRecord = { ...record, key }
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.oncomplete = (): void => resolve()
      tx.onerror = (): void => reject(tx.error ?? new Error('catalog IDB put failed'))
      tx.objectStore(STORE).put(full)
    })
  } catch {
    /* quota / private mode — não bloquear app */
  }
  // Limpar snapshots com mais de 30 dias em background (não bloqueia o caller)
  void pruneStaleSnapshots()
}

/** Remove snapshots com mais de 30 dias para evitar crescimento ilimitado do IndexedDB. */
async function pruneStaleSnapshots(): Promise<void> {
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
  const cutoff = Date.now() - MAX_AGE_MS
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const req = store.openCursor()
      req.onerror = (): void => reject(req.error ?? new Error('catalog IDB prune cursor failed'))
      req.onsuccess = (): void => {
        const cursor = req.result
        if (!cursor) return
        const rec = cursor.value as CatalogSnapshotRecord
        if (rec.cachedAtMs < cutoff) {
          cursor.delete()
        }
        cursor.continue()
      }
      tx.oncomplete = (): void => resolve()
      tx.onerror = (): void => reject(tx.error ?? new Error('catalog IDB prune tx failed'))
    })
  } catch {
    /* ignore — cleanup is best-effort */
  }
}

export async function deleteCatalogSnapshot(
  kind: CatalogSnapshotKind,
  playlistId: string
): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.oncomplete = (): void => resolve()
      tx.onerror = (): void => reject(tx.error ?? new Error('catalog IDB delete failed'))
      tx.objectStore(STORE).delete(snapshotKey(kind, playlistId))
    })
  } catch {
    /* ignore */
  }
}

export async function deleteAllSnapshotsOfKind(kind: CatalogSnapshotKind): Promise<void> {
  const prefix = `${kind}:`
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const req = store.openCursor()
      req.onerror = (): void => reject(req.error ?? new Error('catalog IDB cursor failed'))
      req.onsuccess = (): void => {
        const cursor = req.result
        if (!cursor) {
          return
        }
        const k = cursor.key
        if (typeof k === 'string' && k.startsWith(prefix)) {
          cursor.delete()
        }
        cursor.continue()
      }
      tx.oncomplete = (): void => resolve()
      tx.onerror = (): void => reject(tx.error ?? new Error('catalog IDB tx failed'))
    })
  } catch {
    /* ignore */
  }
}

export async function deleteCatalogSnapshotsForPlaylist(playlistId: string): Promise<void> {
  const kinds: CatalogSnapshotKind[] = ['live', 'movies', 'series']
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.oncomplete = (): void => resolve()
      tx.onerror = (): void => reject(tx.error ?? new Error('catalog IDB delete failed'))
      const store = tx.objectStore(STORE)
      for (const k of kinds) {
        store.delete(snapshotKey(k, playlistId))
      }
    })
  } catch {
    /* ignore */
  }
}

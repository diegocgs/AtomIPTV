/**
 * Cache IndexedDB da M3U: corpo bruto + snapshot só de canais Live (VOD/séries filtrados).
 * Live TV prefere `liveRows` — carrega de imediato sem re-parse de ficheiros enormes.
 */

import {
  compactLiveRowsToM3uEntries,
  filterM3uEntriesForLive,
  m3uEntriesToCompactLiveRows,
  type M3uLiveCompactRow,
} from '@/lib/m3uLive';
import { parseM3u } from '@/services/m3u';

export type M3uUrlValidationResult =
  | { kind: 'xtream-api' }
  | { kind: 'm3u-downloaded'; text: string };

const DB_NAME = 'nexus-iptv-v1';
const STORE = 'm3uPlaylistBodies';
const DB_VERSION = 1;

type CachedRecord = {
  m3uUrl: string;
  savedAt: number;
  /** Texto completo (opcional se gravação falhar por quota após snapshot). */
  body?: string;
  /** Entradas já filtradas para Live TV. */
  liveRows?: M3uLiveCompactRow[];
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('indexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = (): void => reject(req.error ?? new Error('IDB open failed'));
    req.onsuccess = (): void => resolve(req.result);
    req.onupgradeneeded = (): void => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
  return dbPromise;
}

async function readRecord(playlistId: string): Promise<CachedRecord | undefined> {
  const db = await openDb();
  return await new Promise<CachedRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(playlistId);
    req.onsuccess = (): void => resolve(req.result as CachedRecord | undefined);
    req.onerror = (): void => reject(req.error ?? new Error('IDB read failed'));
  });
}

function buildLiveRowsFromBody(body: string): M3uLiveCompactRow[] {
  const entries = filterM3uEntriesForLive(parseM3u(body));
  return m3uEntriesToCompactLiveRows(entries);
}

async function writeRecord(playlistId: string, rec: CachedRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => reject(tx.error ?? new Error('IDB write failed'));
    tx.objectStore(STORE).put(rec, playlistId);
  });
}

/**
 * Grava corpo M3U + snapshot Live (filtrado). Se quota exceder, tenta só snapshot (ainda serve Live).
 */
export async function putM3uPlaylistBody(
  playlistId: string,
  m3uUrl: string,
  body: string
): Promise<void> {
  const trimmed = m3uUrl.trim();
  const liveRows = buildLiveRowsFromBody(body);
  const full: CachedRecord = { m3uUrl: trimmed, body, savedAt: Date.now(), liveRows };
  try {
    await writeRecord(playlistId, full);
    return;
  } catch (e: unknown) {
    const name = e instanceof DOMException ? e.name : '';
    if (name !== 'QuotaExceededError') throw e;
  }
  await writeRecord(playlistId, { m3uUrl: trimmed, savedAt: Date.now(), liveRows });
  // Limpar entradas com mais de 30 dias em background
  void pruneStaleM3uCache();
}

/** Remove entradas de cache M3U com mais de 30 dias para evitar crescimento ilimitado. */
async function pruneStaleM3uCache(): Promise<void> {
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - MAX_AGE_MS;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.openCursor();
      req.onerror = (): void => reject(req.error ?? new Error('M3U IDB prune cursor failed'));
      req.onsuccess = (): void => {
        const cursor = req.result;
        if (!cursor) return;
        const rec = cursor.value as CachedRecord;
        if (rec.savedAt < cutoff) {
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = (): void => resolve();
      tx.onerror = (): void => reject(tx.error ?? new Error('M3U IDB prune tx failed'));
    });
  } catch {
    /* ignore — cleanup is best-effort */
  }
}

/** Snapshot Live: `null` se não houver cache válido ou for formato antigo só com body. */
export async function getM3uPlaylistLiveRows(
  playlistId: string,
  expectedM3uUrl: string
): Promise<M3uLiveCompactRow[] | null> {
  try {
    const rec = await readRecord(playlistId);
    if (!rec || rec.m3uUrl !== expectedM3uUrl.trim()) return null;
    if (!Array.isArray(rec.liveRows)) return null;
    return rec.liveRows;
  } catch {
    return null;
  }
}

/** Corpo bruto (cache legado ou re-download). */
export async function getM3uPlaylistBody(
  playlistId: string,
  expectedM3uUrl: string
): Promise<string | null> {
  try {
    const rec = await readRecord(playlistId);
    if (!rec || rec.m3uUrl !== expectedM3uUrl.trim()) return null;
    if (typeof rec.body !== 'string') return null;
    return rec.body;
  } catch {
    return null;
  }
}

/**
 * Converte snapshot em entradas M3U (para o mesmo pipeline que `parseM3u`).
 * Usado pela Live TV quando `liveRows` existe.
 */
export function liveRowsToM3uEntries(rows: M3uLiveCompactRow[]) {
  return compactLiveRowsToM3uEntries(rows);
}

export async function deleteM3uPlaylistCache(playlistId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = (): void => resolve();
      tx.onerror = (): void => reject(tx.error ?? new Error('IDB delete failed'));
      tx.objectStore(STORE).delete(playlistId);
    });
  } catch {
    /* ignore */
  }
}

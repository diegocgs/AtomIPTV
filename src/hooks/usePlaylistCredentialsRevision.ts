import { useEffect, useState } from 'react';
import { PLAYLISTS_CHANGED_EVENT, PLAYLISTS_STORAGE_KEY } from '@/lib/playlistsStorage';

/**
 * Incrementa quando playlists/credenciais ativas mudam (mesma aba ou outra aba).
 * Use como dependência de `useEffect` que chama `getXtreamCredentialsForApp()`.
 */
export function usePlaylistCredentialsRevision(): number {
  const [n, setN] = useState(0);

  useEffect(() => {
    const bump = () => setN(v => v + 1);
    window.addEventListener(PLAYLISTS_CHANGED_EVENT, bump);
    const onStorage = (e: StorageEvent) => {
      if (e.key === PLAYLISTS_STORAGE_KEY) bump();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PLAYLISTS_CHANGED_EVENT, bump);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return n;
}

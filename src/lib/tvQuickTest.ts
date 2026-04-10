/**
 * Menos passos no telecomando: builds `vite build --mode tv|tizen` saltam o menu inicial
 * e abrem directamente o Live TV. Para desactivar: `VITE_TV_QUICK_TEST=0` no build.
 *
 * Playlists de exemplo já vêm em `playlistsStorage.ts` (seed quando localStorage vazio).
 */
const mode = import.meta.env.MODE;
const raw = import.meta.env.VITE_TV_QUICK_TEST as string | undefined;

export const TV_QUICK_TEST: boolean =
  raw === '0' || raw === 'false'
    ? false
    : raw === '1' || raw === 'true' || mode === 'tv' || mode === 'tizen';

/** Rota do grid inicial: em teste rápido `/` redireciona para Live TV, por isso o menu fica em `/home`. */
export const HOME_PATH = TV_QUICK_TEST ? '/home' : '/';

export function isAppHomePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/home';
}

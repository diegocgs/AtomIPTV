/**
 * Alvo do proxy dev `server.proxy['/xtream']` em `vite.config.ts`.
 * Importado pelo Vite e pelo cliente para fallback quando `/api/proxy` falha em dev.
 */
export const XTREAM_VITE_DEV_PROXY_TARGET = 'http://assistirpainel.info:8880';

export function xtreamUrlMatchesViteDevProxyTarget(absoluteUrl: string): boolean {
  try {
    const u = new URL(absoluteUrl);
    const t = new URL(XTREAM_VITE_DEV_PROXY_TARGET);
    return u.host.toLowerCase() === t.host.toLowerCase();
  } catch {
    return false;
  }
}

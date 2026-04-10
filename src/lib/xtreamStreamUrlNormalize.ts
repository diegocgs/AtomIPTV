/**
 * Normalização de URLs de stream ao estilo Xtream (M3U / painel).
 * Sem dependências de browser — pode ser importado pelo `vite.config.ts`.
 */

/**
 * Corrige hostname `2fassistirpainel.info` → `assistirpainel.info` (resíduo de `%2F` / slash no authority).
 * Evita remover prefixos legítimos (ex.: primeiro label com dígitos).
 */
function fixCorruptedHost2fPrefix(url: string): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    const host = u.hostname;
    if (host.length < 8) return trimmed;
    if (host.slice(0, 2).toLowerCase() !== '2f') return trimmed;
    const rest = host.slice(2);
    if (!rest.includes('.')) return trimmed;
    const firstLabel = rest.split('.')[0] ?? '';
    if (firstLabel.length > 0 && /\d/.test(firstLabel)) return trimmed;
    if (!/^[a-z0-9.-]+$/i.test(rest)) return trimmed;
    u.hostname = rest;
    return u.toString();
  } catch {
    return trimmed;
  }
}

/** `.../user/pass/123` → `.../user/pass/123.m3u8` quando o path acaba em `/número`. */
export function normalizeTrailingStreamIdToM3u8(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    const path = u.pathname;
    if (!/\/\d+$/.test(path)) return trimmed;
    if (/\.(m3u8|m3u|mp4|ts|mkv|avi|mov)(\?|#|$)/i.test(path + u.search)) return trimmed;
    u.pathname = `${path}.m3u8`;
    return u.toString();
  } catch {
    return trimmed;
  }
}

/**
 * `http://host/user/pass/123.m3u8` → `http://host/live/user/pass/123.m3u8`
 * quando ainda não existe `/live/` (formato típico da API vs atalhos na M3U).
 */
export function ensureXtreamLivePathSegment(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    const path = u.pathname;
    if (path.includes('/live/')) return trimmed;
    const m = path.match(/^\/([^/]+)\/([^/]+)\/(\d+)\.(m3u8|m3u)$/i);
    if (!m?.[1] || !m[2] || !m[3] || !m[4]) return trimmed;
    const ext = m[4].toLowerCase();
    u.pathname = `/live/${m[1]}/${m[2]}/${m[3]}.${ext}`;
    return u.toString();
  } catch {
    return trimmed;
  }
}

/** Ordem: extensão `.m3u8` → inserir `/live/` se aplicável. */
export function normalizeXtreamPlaybackUrl(url: string): string {
  const fixedHost = fixCorruptedHost2fPrefix(url);
  return ensureXtreamLivePathSegment(normalizeTrailingStreamIdToM3u8(fixedHost));
}

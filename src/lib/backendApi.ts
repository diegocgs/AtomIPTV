function normalizeBase(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

const STORAGE_KEY = 'nexus-backend-api-base';

/** Base do proxy HTTP na AWS (API Gateway + Lambda). Sobrescrito por `VITE_BACKEND_API` ou Settings (localStorage). */
export const DEFAULT_BACKEND_PROXY_BASE = 'https://proxy.imagenio.io';

/**
 * TVs/WebViews tratam `host:porta` sem `http://` como esquema inválido (ERR_UNKNOWN_URL_SCHEME).
 */
export function ensureHttpSchemeUrl(raw: string): string {
  const t = normalizeBase(raw);
  if (!t) return DEFAULT_BACKEND_PROXY_BASE;
  if (/^https?:\/\//i.test(t)) return t;
  return `http://${t}`;
}

/** Deep link `#/settings` no mesmo host do proxy — `new URL` evita strings malformadas em WebViews. */
export function buildProxySettingsPageUrl(proxyBase: string): string {
  const base = ensureHttpSchemeUrl(proxyBase);
  const withSlash = base.endsWith('/') ? base : `${base}/`;
  try {
    return new URL('#/settings', withSlash).href;
  } catch {
    return `${normalizeBase(base)}/#/settings`;
  }
}

/** Valor embutido no build (`VITE_BACKEND_API`). */
export function getBuildTimeBackendApiBase(): string | null {
  const raw = (import.meta.env.VITE_BACKEND_API as string | undefined) ?? '';
  const v = normalizeBase(raw);
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) return null;
  return v;
}

/** Override guardado na TV (navegador) — tem prioridade sobre o build. */
export function getBackendApiOverride(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v == null || v.trim() === '') return null;
    return ensureHttpSchemeUrl(v);
  } catch {
    return null;
  }
}

export function setBackendApiOverride(url: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (url == null || url.trim() === '') {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, ensureHttpSchemeUrl(url));
    }
    window.dispatchEvent(new CustomEvent('nexus-backend-api-changed'));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Base para `/proxy` e `/proxy/playlist`: override em Settings → `VITE_BACKEND_API` no build → {@link DEFAULT_BACKEND_PROXY_BASE}.
 */
export function getBackendApiBase(): string {
  const o = getBackendApiOverride();
  if (o) return o;
  const b = getBuildTimeBackendApiBase();
  if (b) return ensureHttpSchemeUrl(b);
  return DEFAULT_BACKEND_PROXY_BASE;
}

export function buildBackendProxyUrl(
  path: '/proxy' | '/hls-proxy' | '/proxy/playlist',
  remoteUrl: string
): string {
  const base = getBackendApiBase();
  return `${base}${path}?url=${encodeURIComponent(remoteUrl)}`;
}

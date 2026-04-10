/**
 * Origem única para URLs de proxy de playback (HLS playlist, segmentos reescritos no servidor, VOD /proxy).
 *
 * - `VITE_PROXY_BASE_URL` (ex.: `http://192.168.0.149:8787`) tem prioridade máxima — essencial para TV na LAN.
 * - Sem isso, com `VITE_BACKEND_API` ou override em Settings → usa essa base remota.
 * - Em `import.meta.env.DEV` no browser, sem nenhum dos anteriores → `window.location.origin` + `/api/hls-proxy` (nunca 127.0.0.1 embutido no bundle).
 * - Caso contrário (ex.: build de produção sem env) → {@link getBackendApiBase} (default remoto do produto).
 */

import { getBackendApiBase, getBackendApiOverride, getBuildTimeBackendApiBase } from '@/lib/backendApi';

export type PlaybackProxyBaseSource =
  | 'vite-proxy-base-env'
  | 'backend-api'
  | 'runtime-dev-middleware'
  | 'default-remote-backend';

export type PlaybackProxyBaseResolution = {
  /** `protocol//host[:port]` sem barra final. */
  origin: string;
  source: PlaybackProxyBaseSource;
  /** Entrada HLS no cliente: `/proxy/playlist` (Node/Lambda) ou `/api/hls-proxy` (middleware Vite). */
  hlsEntryPath: '/proxy/playlist' | '/api/hls-proxy';
  /** `true` se `VITE_PROXY_BASE_URL` definiu esta resolução. */
  fromExplicitViteProxyBaseEnv: boolean;
  /** Hostname é loopback (localhost, 127.0.0.1, …). */
  isLoopbackHost: boolean;
};

function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0';
}

/**
 * Interpreta `VITE_PROXY_BASE_URL` como origem do proxy de playback (path extra é ignorado).
 */
export function parseViteProxyBaseOrigin(): string | null {
  const raw = (import.meta.env.VITE_PROXY_BASE_URL as string | undefined)?.trim();
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function hasExplicitBackendApiConfiguration(): boolean {
  return Boolean(getBuildTimeBackendApiBase() || getBackendApiOverride());
}

function resolutionFromOrigin(
  origin: string,
  source: PlaybackProxyBaseSource,
  hlsEntryPath: '/proxy/playlist' | '/api/hls-proxy',
  fromExplicitViteProxyBaseEnv: boolean
): PlaybackProxyBaseResolution {
  const trimmed = origin.replace(/\/+$/, '');
  let host = '';
  try {
    host = new URL(trimmed).hostname;
  } catch {
    host = '';
  }
  return {
    origin: trimmed,
    source,
    hlsEntryPath,
    fromExplicitViteProxyBaseEnv,
    isLoopbackHost: isLoopbackHostname(host),
  };
}

/**
 * Fonte única de verdade para a origem usada em `/proxy/playlist`, `/proxy/hls` (no servidor) e `/api/hls-proxy` (só dev).
 */
export function getPlaybackProxyBaseResolution(): PlaybackProxyBaseResolution {
  const envOrigin = parseViteProxyBaseOrigin();
  if (envOrigin) {
    return resolutionFromOrigin(envOrigin, 'vite-proxy-base-env', '/proxy/playlist', true);
  }

  if (hasExplicitBackendApiConfiguration()) {
    return resolutionFromOrigin(
      getBackendApiBase(),
      'backend-api',
      '/proxy/playlist',
      false
    );
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return resolutionFromOrigin(
      window.location.origin,
      'runtime-dev-middleware',
      '/api/hls-proxy',
      false
    );
  }

  return resolutionFromOrigin(getBackendApiBase(), 'default-remote-backend', '/proxy/playlist', false);
}

/** URL final do pedido ao proxy para um manifest HLS (entrada playlist). */
export function buildHlsPlaylistProxyUrl(normalizedRemoteUrl: string): string {
  const r = getPlaybackProxyBaseResolution();
  return `${r.origin}${r.hlsEntryPath}?url=${encodeURIComponent(normalizedRemoteUrl)}`;
}

/**
 * Proxy genérico para VOD/progressivo (`/proxy` no Node/Lambda), alinhado à mesma origem que o HLS quando possível.
 */
export function buildProgressivePlaybackProxyUrl(normalizedRemoteUrl: string): string {
  const r = getPlaybackProxyBaseResolution();
  if (r.hlsEntryPath === '/api/hls-proxy') {
    return `${r.origin}/api/vod-proxy?url=${encodeURIComponent(normalizedRemoteUrl)}`;
  }
  return `${r.origin}/proxy?url=${encodeURIComponent(normalizedRemoteUrl)}`;
}

export function describePlaybackProxyBaseResolution(r: PlaybackProxyBaseResolution): string {
  const src =
    r.source === 'vite-proxy-base-env'
      ? 'VITE_PROXY_BASE_URL (build)'
      : r.source === 'backend-api'
        ? 'VITE_BACKEND_API ou override em Settings'
        : r.source === 'runtime-dev-middleware'
          ? 'origem da página (DEV) — /api/hls-proxy no mesmo host que o Vite'
          : 'default remoto (sem env de proxy / backend explícito)';
  const loop = r.isLoopbackHost ? 'loopback' : 'LAN ou host remoto';
  return `${src} | ${loop} | entrada HLS: ${r.hlsEntryPath}`;
}

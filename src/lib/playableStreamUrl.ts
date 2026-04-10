/**
 * Optional AWS HTTP API proxy (Smart TV: HTTPS, CORS, playlist rewrite).
 * Compose with {@link resolvePlaybackUrl} in `hlsDevProxy.ts` — do not use for images/metadata.
 */

import { parseViteProxyBaseOrigin } from '@/lib/playbackProxyBase';
import { normalizeXtreamPlaybackUrl } from '@/lib/xtreamStreamUrlNormalize';

const PROGRESSIVE = /\.(mp4|mkv|avi|mov|webm|wmv)(\?|#|$)/i;

export function isTvProxyEnabled(): boolean {
  return import.meta.env.VITE_USE_TV_PROXY === 'true';
}

/**
 * Origem do proxy HTTP da TV — alinhada a {@link parseViteProxyBaseOrigin} (`VITE_PROXY_BASE_URL`).
 */
export function getTvProxyBase(): string | null {
  return parseViteProxyBaseOrigin();
}

function pathnameLower(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return (url.split('?')[0] ?? url).toLowerCase();
  }
}

/**
 * True if this URL is already wrapped by the TV HTTP proxy (`/proxy/playlist` or `/proxy/hls`).
 */
export function isAlreadyTvProxiedUrl(url: string): boolean {
  const base = getTvProxyBase();
  if (!base) return false;
  try {
    const u = new URL(url);
    const b = new URL(base);
    if (u.origin !== b.origin) return false;
    return u.pathname.startsWith('/proxy/playlist') || u.pathname.startsWith('/proxy/hls');
  } catch {
    return false;
  }
}

/**
 * HLS manifest entry points: `.m3u8` / `.m3u`, dev `/api/hls-proxy`, ou `/proxy/playlist` em qualquer host.
 */
export function urlAppearsToBeHlsManifest(streamUrl: string): boolean {
  if (import.meta.env.DEV && streamUrl.includes('/api/hls-proxy')) return true;
  try {
    const u = new URL(streamUrl);
    if (u.pathname.toLowerCase().includes('/proxy/playlist')) return true;
  } catch {
    /* continua */
  }
  if (isAlreadyTvProxiedUrl(streamUrl) && pathnameLower(streamUrl).includes('/proxy/playlist')) {
    return true;
  }
  const path = pathnameLower(streamUrl);
  return path.endsWith('.m3u8') || path.endsWith('.m3u');
}

/**
 * When proxy is on and the URL is HLS-like, returns
 * `{PROXY}/proxy/playlist?url={encodeURIComponent(original)}`.
 * Otherwise returns `originalUrl` (after Xtream normalization). Safe fallback on invalid input.
 */
export function buildPlayableStreamUrl(originalUrl: string): string {
  const trimmed = originalUrl.trim();
  if (!trimmed) return trimmed;

  let normalized: string;
  try {
    normalized = normalizeXtreamPlaybackUrl(trimmed);
  } catch {
    return trimmed;
  }
  if (!normalized) return trimmed;

  if (!isTvProxyEnabled()) return normalized;

  const base = getTvProxyBase();
  if (!base) return normalized;

  if (!/^https?:\/\//i.test(normalized)) return normalized;

  if (isAlreadyTvProxiedUrl(normalized)) return normalized;

  const pathOnly = pathnameLower(normalized);
  if (PROGRESSIVE.test(pathOnly)) return normalized;

  if (!urlAppearsToBeHlsManifest(normalized)) return normalized;

  try {
    return `${base}/proxy/playlist?url=${encodeURIComponent(normalized)}`;
  } catch {
    return normalized;
  }
}

export function wasTvProxyApplied(_originalNormalized: string, playbackUrl: string): boolean {
  if (!isTvProxyEnabled()) return false;
  const base = getTvProxyBase();
  if (!base) return false;
  return playbackUrl.startsWith(`${base}/proxy/playlist?`);
}

export function logIptvPlaybackDebug(info: {
  original: string;
  finalUrl: string;
  proxyEnabled: boolean;
  usedTvProxy: boolean;
  playbackMode: 'hls.js' | 'native-hls' | 'progressive' | 'avplay';
}): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_IPTV_DEBUG !== 'true') return;
  console.info('[IPTV] original stream:', info.original);
  console.info('[IPTV] final stream:', info.finalUrl);
  console.info('[IPTV] proxy enabled:', info.proxyEnabled);
  console.info('[IPTV] TV proxy applied:', info.usedTvProxy);
  console.info('[IPTV] playback:', info.playbackMode);
}

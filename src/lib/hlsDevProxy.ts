import { normalizeXtreamPlaybackUrl } from '@/lib/xtreamStreamUrlNormalize';
import {
  buildHlsPlaylistProxyUrl,
  buildProgressivePlaybackProxyUrl,
  describePlaybackProxyBaseResolution,
  getPlaybackProxyBaseResolution,
  type PlaybackProxyBaseResolution,
} from '@/lib/playbackProxyBase';
import {
  buildPlayableStreamUrl,
  urlAppearsToBeHlsManifest,
  wasTvProxyApplied,
} from '@/lib/playableStreamUrl';
import { isSamsungTizenLikeRuntime } from '@/lib/tvFocus';

/**
 * VOD progressivo: o browser não envia UA VLC ao pedir o .mp4 direto (403 no painel/Cloudflare).
 * Em dev: `/api/vod-proxy` (Vite, streaming). Em prod: `VITE_VOD_STREAM_URL` (Lambda response streaming).
 *
 * Em Tizen (TV Samsung): AVPlay reproduz HTTP direto sem problemas — o proxy Lambda
 * pode falhar (403, timeout) e é desnecessário. Retorna a URL sem wrapping.
 */
function wrapProgressiveVodUrl(normalized: string): string {
  // Tizen AVPlay: reproduz .mp4/.mkv diretamente via HTTP — sem necessidade de proxy.
  // O proxy Lambda falha frequentemente (403 Cloudflare, limites de streaming).
  if (isSamsungTizenLikeRuntime()) {
    return normalized;
  }
  const q = encodeURIComponent(normalized);
  const streamFn = (import.meta.env.VITE_VOD_STREAM_URL as string | undefined)?.trim();
  if (streamFn) {
    return `${streamFn.replace(/\/$/, '')}?url=${q}`;
  }
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `/api/vod-proxy?url=${q}`;
  }
  return buildProgressivePlaybackProxyUrl(normalized);
}

const VLC_UA = 'VLC/3.0.20 LibVLC/3.0.20';

/** @deprecated use `normalizeXtreamPlaybackUrl` from `@/lib/xtreamStreamUrlNormalize` */
export const normalizeXtreamStyleLiveUrl = normalizeXtreamPlaybackUrl;

const PROGRESSIVE_VIDEO = /\.(mp4|mkv|avi|mov|webm|wmv)(\?|#|$)/i;

/**
 * HLS/live: {@link buildHlsPlaylistProxyUrl} — `VITE_PROXY_BASE_URL`, backend explícito, ou em DEV a origem da página + `/api/hls-proxy`.
 * Ficheiros progressivos (`.mp4`, …) usam {@link wrapProgressiveVodUrl}.
 */
export function toHlsDevPlaybackUrl(streamUrl: string): string {
  const normalized = normalizeXtreamPlaybackUrl(streamUrl);
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    return normalized;
  }
  const pathOnly = (normalized.split('?')[0] ?? '').toLowerCase();
  if (PROGRESSIVE_VIDEO.test(pathOnly)) {
    return wrapProgressiveVodUrl(normalized);
  }
  return buildHlsPlaylistProxyUrl(normalized);
}

/**
 * Full pipeline: Xtream normalize → optional TV HTTP proxy (HLS only) → backend `/proxy/playlist` ou dev `/api/hls-proxy`.
 * When the TV proxy wraps the URL, the backend hop is skipped (single public proxy).
 */
export function resolvePlaybackUrl(streamUrl: string): string {
  const normalized = normalizeXtreamPlaybackUrl(streamUrl.trim());
  if (!normalized) return normalized;
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    return normalized;
  }
  const pathOnly = (normalized.split('?')[0] ?? '').toLowerCase();
  if (PROGRESSIVE_VIDEO.test(pathOnly)) {
    return wrapProgressiveVodUrl(normalized);
  }

  const afterTv = buildPlayableStreamUrl(normalized);
  if (wasTvProxyApplied(normalized, afterTv)) {
    return afterTv;
  }

  return toHlsDevPlaybackUrl(normalized);
}

export type PlaybackUrlTraceStep = {
  key: string;
  label: string;
  value: string;
};

export type PlaybackUrlTraceResult = {
  steps: PlaybackUrlTraceStep[];
  resolvedUrl: string;
  isHlsManifest: boolean;
  isProgressive: boolean;
  tvProxyApplied: boolean;
  playbackProxyBase: PlaybackProxyBaseResolution;
};

/**
 * Espelha o pipeline de {@link resolvePlaybackUrl} para o Playback Debug Lab (`/debug/trace`).
 */
export function getPlaybackUrlTrace(streamUrl: string): PlaybackUrlTraceResult {
  const playbackProxyBase = getPlaybackProxyBaseResolution();
  const original = streamUrl.trim();
  const steps: PlaybackUrlTraceStep[] = [
    { key: 'original', label: '1. Original URL', value: original },
    {
      key: 'playbackProxyBase',
      label: '2. Playback proxy base (getPlaybackProxyBaseResolution)',
      value: [
        `origin: ${playbackProxyBase.origin}`,
        `source: ${playbackProxyBase.source}`,
        `hlsEntryPath: ${playbackProxyBase.hlsEntryPath}`,
        `fromExplicitVITE_PROXY_BASE_URL: ${playbackProxyBase.fromExplicitViteProxyBaseEnv ? 'yes' : 'no'}`,
        `host: ${playbackProxyBase.isLoopbackHost ? 'loopback' : 'LAN or remote'}`,
        describePlaybackProxyBaseResolution(playbackProxyBase),
      ].join('\n'),
    },
  ];

  const normalized = normalizeXtreamPlaybackUrl(original);
  steps.push({
    key: 'normalized',
    label: '3. After normalizeXtreamPlaybackUrl',
    value: normalized,
  });

  if (!normalized) {
    return {
      steps,
      resolvedUrl: normalized,
      isHlsManifest: false,
      isProgressive: false,
      tvProxyApplied: false,
      playbackProxyBase,
    };
  }

  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    return {
      steps,
      resolvedUrl: normalized,
      isHlsManifest: urlAppearsToBeHlsManifest(normalized),
      isProgressive: PROGRESSIVE_VIDEO.test((normalized.split('?')[0] ?? '').toLowerCase()),
      tvProxyApplied: false,
      playbackProxyBase,
    };
  }

  const pathOnly = (normalized.split('?')[0] ?? '').toLowerCase();
  if (PROGRESSIVE_VIDEO.test(pathOnly)) {
    const wrapped = wrapProgressiveVodUrl(normalized);
    steps.push({
      key: 'progressive',
      label: '4. Progressive → wrapProgressiveVodUrl',
      value: wrapped,
    });
    return {
      steps,
      resolvedUrl: wrapped,
      isHlsManifest: false,
      isProgressive: true,
      tvProxyApplied: false,
      playbackProxyBase,
    };
  }

  const afterTv = buildPlayableStreamUrl(normalized);
  steps.push({
    key: 'buildPlayable',
    label: '5. After buildPlayableStreamUrl (optional TV proxy wrap, VITE_USE_TV_PROXY)',
    value: afterTv,
  });

  const tvProxyApplied = wasTvProxyApplied(normalized, afterTv);
  steps.push({
    key: 'tvFlag',
    label: '6. wasTvProxyApplied(normalized, afterTv)',
    value: tvProxyApplied ? 'true' : 'false',
  });

  if (tvProxyApplied) {
    return {
      steps,
      resolvedUrl: afterTv,
      isHlsManifest: urlAppearsToBeHlsManifest(afterTv),
      isProgressive: false,
      tvProxyApplied: true,
      playbackProxyBase,
    };
  }

  const final = toHlsDevPlaybackUrl(normalized);
  steps.push({
    key: 'hlsDev',
    label: '7. After toHlsDevPlaybackUrl (buildHlsPlaylistProxyUrl)',
    value: final,
  });

  return {
    steps,
    resolvedUrl: final,
    isHlsManifest: urlAppearsToBeHlsManifest(final),
    isProgressive: false,
    tvProxyApplied: false,
    playbackProxyBase,
  };
}

export const hlsProxyUpstreamUserAgent = VLC_UA;

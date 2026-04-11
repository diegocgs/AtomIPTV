/**
 * aws-proxy/lambda/index.mjs
 *
 * Handler AWS Lambda com Response Streaming para a API IPTV Samsung.
 * Replica todos os endpoints de server/index.mjs (Express) como handler Lambda puro.
 *
 * Endpoints:
 *   GET /api/health              — health check
 *   GET /api/live/catalog        — catálogo Live TV (M3U / Xtream)
 *   GET /api/vod/movies/catalog  — catálogo de filmes
 *   GET /api/vod/series/catalog  — catálogo de séries
 *   GET /api/vod/movies/info     — detalhe de filme
 *   GET /api/vod/series/info     — detalhe de série
 *   GET /api/proxy?url=          — proxy genérico (Xtream API, M3U fetch)
 *
 * Usa `awslambda.streamifyResponse()` para suportar respostas até 20 MB.
 *
 * NOTA: Os módulos de catálogo (live/, vod/, utils/) são copiados de server/
 * pelo script `npm run lambda:sync` antes do deploy.
 */

import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { resolveLiveCatalogFromRequest } from './live/liveCatalogService.mjs';
import { resolveMoviesCatalogFromRequest } from './vod/moviesCatalogService.mjs';
import { resolveSeriesCatalogFromRequest } from './vod/seriesCatalogService.mjs';
import {
  resolveMoviesVodInfoFromRequest,
  resolveSeriesDetailFromRequest,
} from './vod/vodDetailService.mjs';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

function buildCorsHeaders(origin) {
  const allowOrigin =
    origin && origin !== 'null'
      ? origin
      : origin === 'null'
        ? 'null'
        : '*';
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers':
      'Content-Type, Accept, Accept-Language, Origin, X-Requested-With, Authorization, X-Nexus-Lan, X-Nexus-Connectivity',
    'access-control-allow-private-network': 'true',
    vary: 'Origin',
  };
}

const JSON_CT = { 'content-type': 'application/json; charset=utf-8' };

// ---------------------------------------------------------------------------
// Cache em memória (sobrevive entre requests enquanto a instância está quente)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60_000; // 5 minutos
const catalogCache = new Map();

function catalogCacheKey(path, qs) {
  const params = Object.entries(qs).sort(([a], [b]) => a.localeCompare(b));
  return `${path}?${params.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

function getCached(key) {
  const entry = catalogCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    catalogCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  catalogCache.set(key, { data, ts: Date.now() });
}

const HLS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const LAMBDA_PUBLIC_BASE = (process.env.LAMBDA_PUBLIC_BASE ?? '').replace(/\/+$/, '');

/**
 * Reescreve URLs dentro de um manifest M3U8 para passarem pelo proxy Lambda.
 * Segmentos e sub-playlists relativos são resolvidos contra a URL base do manifest.
 */
function rewriteM3u8(body, baseUrl) {
  const base = new URL(baseUrl);
  // Origem do proxy: variável de ambiente ou inferida
  const proxyOrigin = LAMBDA_PUBLIC_BASE;
  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) return line;
      if (!trimmed) return line;
      try {
        const abs = new URL(trimmed, base).toString();
        return `${proxyOrigin}/api/hls-proxy?url=${encodeURIComponent(abs)}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Helpers de streaming
// ---------------------------------------------------------------------------

async function writeResponse(responseStream, statusCode, headers, body) {
  responseStream = awslambda.HttpResponseStream.from(responseStream, { statusCode, headers });
  const buf =
    body == null || body === ''
      ? Buffer.alloc(0)
      : typeof body === 'string'
        ? Buffer.from(body, 'utf8')
        : body;
  await pipeline(Readable.from([buf]), responseStream);
}

async function writeJson(responseStream, statusCode, cors, data) {
  const body = JSON.stringify(data);
  await writeResponse(responseStream, statusCode, { ...cors, ...JSON_CT }, body);
}

async function streamUpstreamBody(responseStream, statusCode, headers, upstreamBody) {
  responseStream = awslambda.HttpResponseStream.from(responseStream, { statusCode, headers });
  if (upstreamBody) {
    const nodeReadable = Readable.fromWeb(upstreamBody);
    await pipeline(nodeReadable, responseStream);
  } else {
    await pipeline(Readable.from([Buffer.alloc(0)]), responseStream);
  }
}

async function writeError(responseStream, status, message, origin) {
  await writeResponse(
    responseStream,
    status,
    { ...buildCorsHeaders(origin), ...JSON_CT },
    JSON.stringify({ error: message }),
  );
}

// ---------------------------------------------------------------------------
// Handler principal — Response Streaming
// ---------------------------------------------------------------------------

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    const method = (event.requestContext?.http?.method ?? 'GET').toUpperCase();
    const path = event.rawPath ?? '/';
    const qs = event.queryStringParameters ?? {};
    const origin = event.headers?.origin ?? event.headers?.Origin ?? '';

    const cors = buildCorsHeaders(origin);

    // -----------------------------------------------------------------------
    // OPTIONS preflight
    // -----------------------------------------------------------------------
    if (method === 'OPTIONS') {
      await writeResponse(responseStream, 204, cors, '');
      return;
    }

    if (method !== 'GET') {
      await writeError(responseStream, 405, 'Method not allowed', origin);
      return;
    }

    // -----------------------------------------------------------------------
    // GET /api/health
    // -----------------------------------------------------------------------
    if (path === '/api/health') {
      await writeJson(responseStream, 200, cors, {
        ok: true,
        service: 'iptv-samsung-hybrid-api',
      });
      return;
    }

    // -----------------------------------------------------------------------
    // GET /api/live/catalog (cached 5 min)
    // -----------------------------------------------------------------------
    if (path === '/api/live/catalog') {
      const cacheKey = catalogCacheKey(path, qs);
      const cached = getCached(cacheKey);
      if (cached) {
        await writeJson(responseStream, 200, cors, cached);
        return;
      }
      try {
        const result = await resolveLiveCatalogFromRequest(qs);
        result.meta = {
          playlistId: String(qs.playlistId ?? ''),
          playlistName: String(qs.playlistName ?? ''),
        };
        setCache(cacheKey, result);
        await writeJson(responseStream, 200, cors, result);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Live catalog failed';
        console.error('[iptv-api] /api/live/catalog error:', e);
        await writeJson(responseStream, 502, cors, {
          error: 'live_catalog_failed',
          message,
          categories: [],
          channels: [],
          sourceType: 'none',
          loadedAt: Date.now(),
        });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // GET /api/vod/movies/catalog (cached 5 min)
    // -----------------------------------------------------------------------
    if (path === '/api/vod/movies/catalog') {
      const cacheKey = catalogCacheKey(path, qs);
      const cached = getCached(cacheKey);
      if (cached) {
        await writeJson(responseStream, 200, cors, cached);
        return;
      }
      try {
        const result = await resolveMoviesCatalogFromRequest(qs);
        result.meta = {
          playlistId: String(qs.playlistId ?? ''),
          playlistName: String(qs.playlistName ?? ''),
        };
        setCache(cacheKey, result);
        await writeJson(responseStream, 200, cors, result);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Movies catalog failed';
        console.error('[iptv-api] /api/vod/movies/catalog error:', e);
        await writeJson(responseStream, 502, cors, {
          error: 'movies_catalog_failed',
          message,
          categories: [],
          streams: [],
          sourceType: 'none',
          loadedAt: Date.now(),
        });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // GET /api/vod/movies/info (cached 5 min)
    // -----------------------------------------------------------------------
    if (path === '/api/vod/movies/info') {
      const cacheKey = catalogCacheKey(path, qs);
      const cached = getCached(cacheKey);
      if (cached) {
        await writeJson(responseStream, cached === '__404__' ? 404 : 200, cors, cached === '__404__' ? { error: 'vod_info_unavailable' } : cached);
        return;
      }
      try {
        const detail = await resolveMoviesVodInfoFromRequest(qs);
        if (detail == null) {
          setCache(cacheKey, '__404__');
          await writeJson(responseStream, 404, cors, { error: 'vod_info_unavailable' });
          return;
        }
        setCache(cacheKey, detail);
        await writeJson(responseStream, 200, cors, detail);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'VOD info failed';
        console.error('[iptv-api] /api/vod/movies/info error:', e);
        await writeJson(responseStream, 502, cors, { error: 'vod_info_failed', message });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // GET /api/vod/series/info (cached 5 min)
    // -----------------------------------------------------------------------
    if (path === '/api/vod/series/info') {
      const cacheKey = catalogCacheKey(path, qs);
      const cached = getCached(cacheKey);
      if (cached) {
        await writeJson(responseStream, cached === '__404__' ? 404 : 200, cors, cached === '__404__' ? { error: 'series_info_unavailable' } : cached);
        return;
      }
      try {
        const detail = await resolveSeriesDetailFromRequest(qs);
        if (detail == null) {
          setCache(cacheKey, '__404__');
          await writeJson(responseStream, 404, cors, { error: 'series_info_unavailable' });
          return;
        }
        setCache(cacheKey, detail);
        await writeJson(responseStream, 200, cors, detail);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Series info failed';
        console.error('[iptv-api] /api/vod/series/info error:', e);
        await writeJson(responseStream, 502, cors, { error: 'series_info_failed', message });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // GET /api/vod/series/catalog (cached 5 min)
    // -----------------------------------------------------------------------
    if (path === '/api/vod/series/catalog') {
      const cacheKey = catalogCacheKey(path, qs);
      const cached = getCached(cacheKey);
      if (cached) {
        await writeJson(responseStream, 200, cors, cached);
        return;
      }
      try {
        const result = await resolveSeriesCatalogFromRequest(qs);
        result.meta = {
          playlistId: String(qs.playlistId ?? ''),
          playlistName: String(qs.playlistName ?? ''),
        };
        setCache(cacheKey, result);
        await writeJson(responseStream, 200, cors, result);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Series catalog failed';
        console.error('[iptv-api] /api/vod/series/catalog error:', e);
        await writeJson(responseStream, 502, cors, {
          error: 'series_catalog_failed',
          message,
          categories: [],
          series: [],
          sourceType: 'none',
          loadedAt: Date.now(),
        });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // GET /api/proxy?url= — proxy genérico
    // -----------------------------------------------------------------------
    if (path === '/api/proxy') {
      const target = String(qs.url ?? '').trim();
      if (!target) {
        await writeJson(responseStream, 400, cors, { error: 'Missing url parameter' });
        return;
      }
      let parsed;
      try {
        parsed = new URL(target);
      } catch {
        await writeJson(responseStream, 400, cors, { error: 'Invalid url parameter' });
        return;
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        await writeJson(responseStream, 400, cors, { error: 'Only http(s) URLs are allowed' });
        return;
      }
      try {
        const upstream = await fetch(target, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': HLS_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
          },
        });
        const ct = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8';
        const text = await upstream.text();
        await writeResponse(responseStream, upstream.status, {
          ...cors,
          'content-type': ct,
        }, text);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Proxy fetch failed';
        console.error('[iptv-api] /api/proxy error:', e);
        await writeJson(responseStream, 502, cors, { error: 'proxy_failed', message: msg });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // GET /api/proxy/playlist?url= — HLS manifest proxy com reescrita de URLs
    // GET /api/hls-proxy?url=       — alias
    // -----------------------------------------------------------------------
    if (path === '/api/proxy/playlist' || path === '/api/hls-proxy') {
      const target = String(qs.url ?? '').trim();
      if (!target) {
        await writeJson(responseStream, 400, cors, { error: 'Missing url parameter' });
        return;
      }
      let parsed;
      try {
        parsed = new URL(target);
      } catch {
        await writeJson(responseStream, 400, cors, { error: 'Invalid url parameter' });
        return;
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        await writeJson(responseStream, 400, cors, { error: 'Only http(s) URLs are allowed' });
        return;
      }
      try {
        const upstream = await fetch(target, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': HLS_UA,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        });
        const ct = upstream.headers.get('content-type') ?? '';
        const body = await upstream.text();

        const isM3u8 =
          ct.includes('mpegurl') ||
          ct.includes('m3u') ||
          target.includes('.m3u8') ||
          target.includes('.m3u');

        if (isM3u8 && upstream.status >= 200 && upstream.status < 300) {
          const rewritten = rewriteM3u8(body, upstream.url || target);
          await writeResponse(responseStream, 200, {
            ...cors,
            'content-type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'cache-control': 'no-store',
          }, rewritten);
        } else {
          await writeResponse(responseStream, upstream.status, {
            ...cors,
            'content-type': ct || 'application/octet-stream',
            'cache-control': 'no-store',
          }, body);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'HLS proxy fetch failed';
        console.error('[iptv-api] /api/proxy/playlist error:', e);
        await writeJson(responseStream, 502, cors, { error: 'hls_proxy_failed', message: msg });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // GET /api/vod-proxy?url= — proxy VOD progressivo (streaming)
    // -----------------------------------------------------------------------
    if (path === '/api/vod-proxy') {
      const target = String(qs.url ?? '').trim();
      if (!target) {
        await writeJson(responseStream, 400, cors, { error: 'Missing url parameter' });
        return;
      }
      let parsed;
      try {
        parsed = new URL(target);
      } catch {
        await writeJson(responseStream, 400, cors, { error: 'Invalid url parameter' });
        return;
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        await writeJson(responseStream, 400, cors, { error: 'Only http(s) URLs are allowed' });
        return;
      }
      try {
        const upstream = await fetch(target, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
            Accept: '*/*',
          },
        });
        const ct = upstream.headers.get('content-type') ?? 'application/octet-stream';
        const upstreamHeaders = {
          ...cors,
          'content-type': ct,
          'cache-control': 'no-store',
        };
        const cl = upstream.headers.get('content-length');
        if (cl) upstreamHeaders['content-length'] = cl;
        const ar = upstream.headers.get('accept-ranges');
        if (ar) upstreamHeaders['accept-ranges'] = ar;

        if (upstream.body) {
          await streamUpstreamBody(responseStream, upstream.status, upstreamHeaders, upstream.body);
        } else {
          await writeResponse(responseStream, upstream.status, upstreamHeaders, '');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'VOD proxy fetch failed';
        console.error('[iptv-api] /api/vod-proxy error:', e);
        await writeJson(responseStream, 502, cors, { error: 'vod_proxy_failed', message: msg });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // 404
    // -----------------------------------------------------------------------
    await writeError(responseStream, 404, 'Not found', origin);
  },
);

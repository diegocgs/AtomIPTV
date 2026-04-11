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
      'Content-Type, Accept, Accept-Language, Origin, X-Requested-With, Authorization',
    'access-control-allow-private-network': 'true',
    vary: 'Origin',
  };
}

const JSON_CT = { 'content-type': 'application/json; charset=utf-8' };

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
    // GET /api/live/catalog
    // -----------------------------------------------------------------------
    if (path === '/api/live/catalog') {
      try {
        const result = await resolveLiveCatalogFromRequest(qs);
        result.meta = {
          playlistId: String(qs.playlistId ?? ''),
          playlistName: String(qs.playlistName ?? ''),
        };
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
    // GET /api/vod/movies/catalog
    // -----------------------------------------------------------------------
    if (path === '/api/vod/movies/catalog') {
      try {
        const result = await resolveMoviesCatalogFromRequest(qs);
        result.meta = {
          playlistId: String(qs.playlistId ?? ''),
          playlistName: String(qs.playlistName ?? ''),
        };
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
    // GET /api/vod/movies/info
    // -----------------------------------------------------------------------
    if (path === '/api/vod/movies/info') {
      try {
        const detail = await resolveMoviesVodInfoFromRequest(qs);
        if (detail == null) {
          await writeJson(responseStream, 404, cors, { error: 'vod_info_unavailable' });
          return;
        }
        await writeJson(responseStream, 200, cors, detail);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'VOD info failed';
        console.error('[iptv-api] /api/vod/movies/info error:', e);
        await writeJson(responseStream, 502, cors, { error: 'vod_info_failed', message });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // GET /api/vod/series/info
    // -----------------------------------------------------------------------
    if (path === '/api/vod/series/info') {
      try {
        const detail = await resolveSeriesDetailFromRequest(qs);
        if (detail == null) {
          await writeJson(responseStream, 404, cors, { error: 'series_info_unavailable' });
          return;
        }
        await writeJson(responseStream, 200, cors, detail);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Series info failed';
        console.error('[iptv-api] /api/vod/series/info error:', e);
        await writeJson(responseStream, 502, cors, { error: 'series_info_failed', message });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // GET /api/vod/series/catalog
    // -----------------------------------------------------------------------
    if (path === '/api/vod/series/catalog') {
      try {
        const result = await resolveSeriesCatalogFromRequest(qs);
        result.meta = {
          playlistId: String(qs.playlistId ?? ''),
          playlistName: String(qs.playlistName ?? ''),
        };
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
            'User-Agent': 'IPTV-Samsung/1.0',
            Accept: 'application/json, */*',
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
    // 404
    // -----------------------------------------------------------------------
    await writeError(responseStream, 404, 'Not found', origin);
  },
);

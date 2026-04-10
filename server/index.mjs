import express from 'express'
import cors from 'cors'
import { resolveLiveCatalogFromRequest } from './live/liveCatalogService.mjs'
import { resolveMoviesCatalogFromRequest } from './vod/moviesCatalogService.mjs'
import { resolveSeriesCatalogFromRequest } from './vod/seriesCatalogService.mjs'
import { resolveMoviesVodInfoFromRequest, resolveSeriesDetailFromRequest } from './vod/vodDetailService.mjs'

const app = express()
app.use(
  cors({
    origin: true,
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'iptv-samsung-hybrid-api' })
})

app.get('/api/live/catalog', async (req, res) => {
  try {
    const result = await resolveLiveCatalogFromRequest(req.query)
    result.meta = {
      playlistId: String(req.query.playlistId ?? ''),
      playlistName: String(req.query.playlistName ?? ''),
    }
    res.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Live catalog failed'
    res.status(502).json({
      error: 'live_catalog_failed',
      message,
      categories: [],
      channels: [],
      sourceType: 'none',
      loadedAt: Date.now(),
    })
  }
})

app.get('/api/vod/movies/catalog', async (req, res) => {
  try {
    const result = await resolveMoviesCatalogFromRequest(req.query)
    result.meta = {
      playlistId: String(req.query.playlistId ?? ''),
      playlistName: String(req.query.playlistName ?? ''),
    }
    res.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Movies catalog failed'
    res.status(502).json({
      error: 'movies_catalog_failed',
      message,
      categories: [],
      streams: [],
      sourceType: 'none',
      loadedAt: Date.now(),
    })
  }
})

app.get('/api/vod/movies/info', async (req, res) => {
  try {
    const detail = await resolveMoviesVodInfoFromRequest(req.query)
    if (detail == null) {
      return res.status(404).json({ error: 'vod_info_unavailable' })
    }
    res.json(detail)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'VOD info failed'
    res.status(502).json({ error: 'vod_info_failed', message })
  }
})

app.get('/api/vod/series/info', async (req, res) => {
  try {
    const detail = await resolveSeriesDetailFromRequest(req.query)
    if (detail == null) {
      return res.status(404).json({ error: 'series_info_unavailable' })
    }
    res.json(detail)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Series info failed'
    res.status(502).json({ error: 'series_info_failed', message })
  }
})

app.get('/api/vod/series/catalog', async (req, res) => {
  try {
    const result = await resolveSeriesCatalogFromRequest(req.query)
    result.meta = {
      playlistId: String(req.query.playlistId ?? ''),
      playlistName: String(req.query.playlistName ?? ''),
    }
    res.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Series catalog failed'
    res.status(502).json({
      error: 'series_catalog_failed',
      message,
      categories: [],
      series: [],
      sourceType: 'none',
      loadedAt: Date.now(),
    })
  }
})

/**
 * Proxy genérico para chamadas Xtream API do browser client.
 * O browser não pode fazer fetch cross-origin diretamente ao painel;
 * este endpoint faz o pedido server-side (sem restrições CORS) e devolve a resposta.
 * Usado por `xtreamFetch()` → `/api/proxy?url=<encoded>` via Vite dev proxy.
 */
app.get('/api/proxy', async (req, res) => {
  const target = String(req.query.url ?? '').trim()
  if (!target) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }
  let parsed
  try {
    parsed = new URL(target)
  } catch {
    return res.status(400).json({ error: 'Invalid url parameter' })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http(s) URLs are allowed' })
  }
  try {
    const upstream = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'IPTV-Samsung/1.0',
        'Accept': 'application/json, */*',
      },
    })
    const ct = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8'
    res.status(upstream.status)
    res.setHeader('Content-Type', ct)
    res.setHeader('Access-Control-Allow-Origin', '*')
    const text = await upstream.text()
    res.send(text)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Proxy fetch failed'
    res.status(502).json({ error: 'proxy_failed', message: msg })
  }
})

const port = Number(process.env.HYBRID_API_PORT ?? 8787)
const host = process.env.HYBRID_API_HOST ?? '0.0.0.0'

app.listen(port, host, () => {
  console.log(`[hybrid-api] running on http://${host}:${port}`)
})

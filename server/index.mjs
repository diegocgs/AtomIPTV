import express from 'express'
import cors from 'cors'
import { resolveLiveCatalogFromRequest } from './live/liveCatalogService.mjs'

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

const port = Number(process.env.HYBRID_API_PORT ?? 8787)
const host = process.env.HYBRID_API_HOST ?? '0.0.0.0'

app.listen(port, host, () => {
  console.log(`[hybrid-api] running on http://${host}:${port}`)
})

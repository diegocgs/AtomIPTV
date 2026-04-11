/**
 * Fetch direto à Xtream API (sem Lambda proxy) derivando credenciais do URL M3U.
 *
 * Quando a Lambda recebe 403 do Cloudflare, o proxy não consegue baixar o M3U.
 * Em Tizen WebView (file://) o fetch direto ao painel IPTV funciona (mesmo IP local).
 * A API Xtream retorna JSON leve (~1MB) — muito mais rápido que o M3U completo (~50MB).
 *
 * Se o m3uUrl é um short link (ex: https://2836.short.gy/artik2), resolve o redirect
 * para obter a URL final com username/password nos query params.
 */

import type { XtreamVodCategory, XtreamVodStream } from '@/services/xtream'
import type { XtreamSeriesCategory, XtreamSeriesStream } from '@/services/xtream'
import type { MoviesCatalogResult } from '../types/moviesCatalog'
import type { SeriesCatalogResult } from '../types/seriesCatalog'

// ─── helpers ────────────────────────────────────────────────────────────────────

interface XtreamCreds {
  origin: string
  username: string
  password: string
}

/** Cache em memória — evita resolver o short link múltiplas vezes na mesma sessão. */
const credsCache = new Map<string, XtreamCreds | null>()

function extractCredsFromUrl(url: string): XtreamCreds | null {
  try {
    const u = new URL(url)
    const username = u.searchParams.get('username')
    const password = u.searchParams.get('password')
    if (!username || !password) return null
    return { origin: u.origin, username, password }
  } catch {
    return null
  }
}

/**
 * Resolve credenciais a partir de qualquer M3U URL.
 * Se a URL já tem username/password, extrai diretamente.
 * Se é um short link, faz fetch para seguir o redirect e pega a URL final.
 * Resultado é cacheado em memória.
 */
async function resolveXtreamCreds(m3uUrl: string): Promise<XtreamCreds | null> {
  // Check cache
  if (credsCache.has(m3uUrl)) return credsCache.get(m3uUrl)!

  // 1. Tentar extrair da URL diretamente
  const direct = extractCredsFromUrl(m3uUrl)
  if (direct) {
    credsCache.set(m3uUrl, direct)
    return direct
  }

  // 2. Resolver short link seguindo redirect — pegar response.url sem baixar o body
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(m3uUrl, { signal: controller.signal })
    clearTimeout(timeoutId)
    // res.url contém a URL final após redirects
    const finalUrl = res.url
    // Fechar body stream imediatamente para NÃO baixar o M3U (~50MB)
    try { void res.body?.cancel() } catch { /* ok */ }
    try { controller.abort() } catch { /* ok */ }
    if (finalUrl && finalUrl !== m3uUrl) {
      const creds = extractCredsFromUrl(finalUrl)
      if (creds) {
        credsCache.set(m3uUrl, creds)
        return creds
      }
    }
  } catch {
    // redirect resolution falhou
  }

  credsCache.set(m3uUrl, null)
  return null
}

function buildApiUrl(origin: string, username: string, password: string, action: string): string {
  const qp = new URLSearchParams({ username, password, action })
  return `${origin}/player_api.php?${qp}`
}

function toRecord(v: unknown): Record<string, unknown> {
  return v != null && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

// ─── VOD Movies ─────────────────────────────────────────────────────────────────

/**
 * Retorna resultado no formato M3U (sourceType='m3u', m3uStreamUrls populado)
 * para que resolveMoviePlayUrl() consiga resolver a URL de playback.
 */
export async function directXtreamVodFetch(m3uUrl: string): Promise<MoviesCatalogResult | null> {
  const creds = await resolveXtreamCreds(m3uUrl)
  if (!creds) return null
  try {
    const [catsRes, streamsRes] = await Promise.all([
      fetch(buildApiUrl(creds.origin, creds.username, creds.password, 'get_vod_categories')),
      fetch(buildApiUrl(creds.origin, creds.username, creds.password, 'get_vod_streams')),
    ])
    if (!catsRes.ok || !streamsRes.ok) return null
    const rawCats = await catsRes.json() as unknown[]
    const rawStreams = await streamsRes.json() as unknown[]
    const categories: XtreamVodCategory[] = (Array.isArray(rawCats) ? rawCats : [])
      .map(toRecord)
      .filter(c => c.category_id && c.category_name)
      .map(c => ({ category_id: str(c.category_id), category_name: str(c.category_name) }))
    const streams: XtreamVodStream[] = (Array.isArray(rawStreams) ? rawStreams : [])
      .map(toRecord)
      .filter(s => s.stream_id != null && s.name)
      .map(s => ({
        stream_id: Number(s.stream_id),
        name: str(s.name),
        stream_icon: s.stream_icon ? str(s.stream_icon) : undefined,
        category_id: s.category_id != null ? str(s.category_id) : null,
        container_extension: s.container_extension ? str(s.container_extension) : undefined,
        rating: s.rating ? str(s.rating) : undefined,
        plot: s.plot ? str(s.plot) : undefined,
        genre: s.genre ? str(s.genre) : undefined,
        director: s.director ? str(s.director) : undefined,
        cast: s.cast ? str(s.cast) : undefined,
      }))
    // Construir m3uStreamUrls para que resolveMoviePlayUrl() funcione
    const m3uStreamUrls: Record<string, string> = {}
    for (const s of streams) {
      const ext = s.container_extension?.replace(/^\./, '') || 'mp4'
      m3uStreamUrls[String(s.stream_id)] =
        `${creds.origin}/movie/${creds.username}/${creds.password}/${s.stream_id}.${ext}`
    }
    return {
      categories,
      streams,
      m3uStreamUrls,
      sourceType: 'm3u',
      loadedAt: Date.now(),
    }
  } catch {
    return null
  }
}

// ─── Series ─────────────────────────────────────────────────────────────────────

/**
 * Retorna resultado no formato M3U (sourceType='m3u', m3uSeriesUrls populado)
 * para que resolveSeriesPlayUrl() consiga resolver a URL de playback.
 */
export async function directXtreamSeriesFetch(m3uUrl: string): Promise<SeriesCatalogResult | null> {
  const creds = await resolveXtreamCreds(m3uUrl)
  if (!creds) return null
  try {
    const [catsRes, seriesRes] = await Promise.all([
      fetch(buildApiUrl(creds.origin, creds.username, creds.password, 'get_series_categories')),
      fetch(buildApiUrl(creds.origin, creds.username, creds.password, 'get_series')),
    ])
    if (!catsRes.ok || !seriesRes.ok) return null
    const rawCats = await catsRes.json() as unknown[]
    const rawSeries = await seriesRes.json() as unknown[]
    const categories: XtreamSeriesCategory[] = (Array.isArray(rawCats) ? rawCats : [])
      .map(toRecord)
      .filter(c => c.category_id && c.category_name)
      .map(c => ({ category_id: str(c.category_id), category_name: str(c.category_name) }))
    const series: XtreamSeriesStream[] = (Array.isArray(rawSeries) ? rawSeries : [])
      .map(toRecord)
      .filter(s => (s.series_id != null || s.stream_id != null) && s.name)
      .map(s => ({
        series_id: Number(s.series_id ?? s.stream_id),
        name: str(s.name),
        cover: s.cover ? str(s.cover) : (s.stream_icon ? str(s.stream_icon) : undefined),
        category_id: s.category_id != null ? str(s.category_id) : null,
        rating: s.rating ? str(s.rating) : undefined,
        plot: s.plot ? str(s.plot) : undefined,
        genre: s.genre ? str(s.genre) : undefined,
        cast: s.cast ? str(s.cast) : undefined,
      }))
    // Nota: para séries, o URL direto não resolve episódios individuais.
    // O m3uSeriesUrls aqui permite ao resolveSeriesPlayUrl identificar que há conteúdo,
    // mas o playback de episódios pode precisar de lógica adicional.
    const m3uSeriesUrls: Record<string, string> = {}
    for (const s of series) {
      m3uSeriesUrls[String(s.series_id)] =
        `${creds.origin}/series/${creds.username}/${creds.password}/${s.series_id}`
    }
    return {
      categories,
      series,
      m3uSeriesUrls,
      sourceType: 'm3u',
      loadedAt: Date.now(),
    }
  } catch {
    return null
  }
}

// ─── Live ───────────────────────────────────────────────────────────────────────

export interface DirectLiveStream {
  stream_id: number
  name: string
  stream_icon?: string
  category_id?: string | null
  epg_channel_id?: string | null
}

export interface DirectLiveCategory {
  category_id: string
  category_name: string
}

export async function directXtreamLiveFetch(m3uUrl: string): Promise<{
  categories: DirectLiveCategory[]
  streams: DirectLiveStream[]
  creds: XtreamCreds
} | null> {
  const creds = await resolveXtreamCreds(m3uUrl)
  if (!creds) return null
  try {
    const [catsRes, streamsRes] = await Promise.all([
      fetch(buildApiUrl(creds.origin, creds.username, creds.password, 'get_live_categories')),
      fetch(buildApiUrl(creds.origin, creds.username, creds.password, 'get_live_streams')),
    ])
    if (!catsRes.ok || !streamsRes.ok) return null
    const rawCats = await catsRes.json() as unknown[]
    const rawStreams = await streamsRes.json() as unknown[]
    const categories: DirectLiveCategory[] = (Array.isArray(rawCats) ? rawCats : [])
      .map(toRecord)
      .filter(c => c.category_id && c.category_name)
      .map(c => ({ category_id: str(c.category_id), category_name: str(c.category_name) }))
    const streams: DirectLiveStream[] = (Array.isArray(rawStreams) ? rawStreams : [])
      .map(toRecord)
      .filter(s => s.stream_id != null && s.name)
      .map(s => ({
        stream_id: Number(s.stream_id),
        name: str(s.name).trim() || `Channel ${s.stream_id}`,
        stream_icon: s.stream_icon ? str(s.stream_icon) : undefined,
        category_id: s.category_id != null ? str(s.category_id) : null,
        epg_channel_id: s.epg_channel_id ? str(s.epg_channel_id) : null,
      }))
    return { categories, streams, creds }
  } catch {
    return null
  }
}

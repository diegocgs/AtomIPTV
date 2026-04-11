import { parseM3uText } from '../live/m3uParser.mjs'
import { xtreamGetSeries, xtreamGetSeriesCategories } from '../live/xtreamApi.mjs'
import { filterM3uEntriesForSeries } from './m3uSeriesFilter.mjs'
import { buildM3uSeriesCatalog } from './m3uSeriesCatalog.mjs'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function fetchM3uText(url) {
  let hdrs
  try {
    const origin = new URL(url).origin
    hdrs = { 'User-Agent': BROWSER_UA, Referer: `${origin}/`, Accept: '*/*' }
  } catch {
    hdrs = { 'User-Agent': BROWSER_UA }
  }
  const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: hdrs })
  if (!res.ok) {
    const hint = await res.text().catch(() => '')
    throw new Error(`M3U fetch failed: ${res.status}${hint ? ` — ${hint.slice(0, 200)}` : ''}`)
  }
  return res.text()
}

function readString(v) {
  if (v == null) return ''
  return typeof v === 'string' ? v : String(v)
}

function firstNonEmpty(...parts) {
  for (const p of parts) {
    const t = p != null ? String(p).trim() : ''
    if (t) return t
  }
  return ''
}

function normalizeSeriesCategory(row) {
  const id = readString(row?.category_id)
  const name = readString(row?.category_name)
  if (!id || !name) return null
  return { category_id: id, category_name: name }
}

function normalizeSeriesRow(row) {
  const seriesId = Number(row?.series_id ?? row?.stream_id)
  const name = readString(row?.name).trim()
  if (!Number.isFinite(seriesId) || !name) return null
  const categoryId = row?.category_id == null ? null : readString(row.category_id)
  const coverArt = firstNonEmpty(
    readString(row?.cover_big),
    readString(row?.cover),
    readString(row?.stream_icon),
    readString(row?.icon),
    readString(row?.thumbnail),
    readString(row?.backdrop_path)
  )
  return {
    series_id: seriesId,
    name,
    cover: coverArt || undefined,
    category_id: categoryId,
    last_modified: row?.last_modified == null ? undefined : readString(row.last_modified),
    rating: row?.rating == null ? undefined : readString(row.rating),
    plot: row?.plot == null ? undefined : readString(row.plot),
    description: row?.description == null ? undefined : readString(row.description),
    synopsis: row?.synopsis == null ? undefined : readString(row.synopsis),
    genre: row?.genre == null ? undefined : readString(row.genre),
    cast: row?.cast == null ? undefined : readString(row.cast),
    releaseDate: row?.releaseDate == null ? undefined : readString(row.releaseDate),
    release_date: row?.release_date == null ? undefined : readString(row.release_date),
    year: row?.year == null ? undefined : row.year,
  }
}

async function resolveM3uSeriesCatalog(m3uUrl) {
  const raw = await fetchM3uText(m3uUrl)
  const entries = filterM3uEntriesForSeries(parseM3uText(raw))
  const built = buildM3uSeriesCatalog(entries)
  return {
    categories: built.categories,
    series: built.series,
    m3uSeriesUrls: built.m3uSeriesUrls,
    sourceType: 'm3u',
    loadedAt: Date.now(),
  }
}

async function resolveXtreamSeriesCatalog(baseUrl, username, password) {
  const [catRows, seriesRows] = await Promise.all([
    xtreamGetSeriesCategories(baseUrl, username, password),
    xtreamGetSeries(baseUrl, username, password),
  ])
  const categories = catRows.map(normalizeSeriesCategory).filter(Boolean)
  const series = seriesRows.map(normalizeSeriesRow).filter(Boolean)
  return {
    categories,
    series,
    m3uSeriesUrls: undefined,
    sourceType: 'xtream',
    loadedAt: Date.now(),
  }
}

function emptyResult() {
  return {
    categories: [],
    series: [],
    m3uSeriesUrls: undefined,
    sourceType: 'none',
    loadedAt: Date.now(),
  }
}

export async function resolveSeriesCatalogFromRequest(query) {
  const sourceType = String(query.sourceType ?? '').trim()
  if (sourceType === 'm3u') {
    const m3uUrl = String(query.m3uUrl ?? '').trim()
    if (!m3uUrl) return emptyResult()
    return resolveM3uSeriesCatalog(m3uUrl)
  }
  if (sourceType === 'xtream') {
    const baseUrl = String(query.baseUrl ?? '').trim()
    const username = String(query.username ?? '').trim()
    const password = String(query.password ?? '')
    if (!baseUrl || !username || !password) return emptyResult()
    return resolveXtreamSeriesCatalog(baseUrl, username, password)
  }
  return emptyResult()
}

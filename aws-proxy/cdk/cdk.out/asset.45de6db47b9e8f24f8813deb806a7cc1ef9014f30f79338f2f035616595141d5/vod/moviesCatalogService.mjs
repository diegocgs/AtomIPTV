import { parseM3uText } from '../live/m3uParser.mjs'
import { xtreamGetVodCategories, xtreamGetVodStreams } from '../live/xtreamApi.mjs'
import { filterM3uEntriesForVodMovies } from './m3uVodFilter.mjs'
import { buildM3uVodMovieCatalog } from './m3uMoviesCatalog.mjs'

async function fetchM3uText(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'follow' })
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

function normalizeVodCategory(row) {
  const id = readString(row?.category_id)
  const name = readString(row?.category_name)
  if (!id || !name) return null
  return { category_id: id, category_name: name }
}

function normalizeVodStream(row) {
  const streamId = Number(row?.stream_id)
  const name = readString(row?.name).trim()
  if (!Number.isFinite(streamId) || !name) return null
  const categoryId = row?.category_id == null ? null : readString(row.category_id)
  const out = {
    stream_id: streamId,
    name,
    stream_icon: row?.stream_icon == null ? undefined : readString(row.stream_icon),
    category_id: categoryId,
    added: row?.added == null ? undefined : readString(row.added),
    rating: row?.rating == null ? undefined : readString(row.rating),
    container_extension:
      row?.container_extension == null ? undefined : readString(row.container_extension),
    plot: row?.plot == null ? undefined : readString(row.plot),
    description: row?.description == null ? undefined : readString(row.description),
    synopsis: row?.synopsis == null ? undefined : readString(row.synopsis),
    genre: row?.genre == null ? undefined : readString(row.genre),
    director: row?.director == null ? undefined : readString(row.director),
    cast: row?.cast == null ? undefined : readString(row.cast),
    releaseDate: row?.releaseDate == null ? undefined : readString(row.releaseDate),
    release_date: row?.release_date == null ? undefined : readString(row.release_date),
    year: row?.year == null ? undefined : row.year,
    duration: row?.duration == null ? undefined : readString(row.duration),
    duration_secs: row?.duration_secs == null ? undefined : row.duration_secs,
  }
  return out
}

async function resolveM3uMoviesCatalog(m3uUrl) {
  const raw = await fetchM3uText(m3uUrl)
  const entries = filterM3uEntriesForVodMovies(parseM3uText(raw))
  const built = buildM3uVodMovieCatalog(entries)
  return {
    categories: built.categories,
    streams: built.streams,
    m3uStreamUrls: built.m3uStreamUrls,
    sourceType: 'm3u',
    loadedAt: Date.now(),
  }
}

async function resolveXtreamMoviesCatalog(baseUrl, username, password) {
  const [catRows, streamRows] = await Promise.all([
    xtreamGetVodCategories(baseUrl, username, password),
    xtreamGetVodStreams(baseUrl, username, password),
  ])
  const categories = catRows.map(normalizeVodCategory).filter(Boolean)
  const streams = streamRows.map(normalizeVodStream).filter(Boolean)
  return {
    categories,
    streams,
    m3uStreamUrls: undefined,
    sourceType: 'xtream',
    loadedAt: Date.now(),
  }
}

function emptyResult() {
  return {
    categories: [],
    streams: [],
    m3uStreamUrls: undefined,
    sourceType: 'none',
    loadedAt: Date.now(),
  }
}

export async function resolveMoviesCatalogFromRequest(query) {
  const sourceType = String(query.sourceType ?? '').trim()
  if (sourceType === 'm3u') {
    const m3uUrl = String(query.m3uUrl ?? '').trim()
    if (!m3uUrl) return emptyResult()
    return resolveM3uMoviesCatalog(m3uUrl)
  }
  if (sourceType === 'xtream') {
    const baseUrl = String(query.baseUrl ?? '').trim()
    const username = String(query.username ?? '').trim()
    const password = String(query.password ?? '')
    if (!baseUrl || !username || !password) return emptyResult()
    return resolveXtreamMoviesCatalog(baseUrl, username, password)
  }
  return emptyResult()
}

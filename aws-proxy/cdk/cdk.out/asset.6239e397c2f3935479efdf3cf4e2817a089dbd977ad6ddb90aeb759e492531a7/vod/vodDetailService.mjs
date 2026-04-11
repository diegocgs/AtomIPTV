import { xtreamGetSeriesInfo, xtreamGetVodInfo } from '../live/xtreamApi.mjs'

function toRecord(value) {
  return typeof value === 'object' && value !== null ? value : {}
}

function readString(value) {
  if (value == null) return ''
  return typeof value === 'string' ? value : String(value)
}

function firstNonEmpty(...parts) {
  for (const p of parts) {
    const t = p == null ? '' : String(p).trim()
    if (t) return t
  }
  return ''
}

function readOptionalNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function parseReleaseYear(value) {
  if (value == null || !String(value).trim()) return null
  const s = String(value).trim()
  const m = s.match(/^(\d{4})/)
  if (m) return Number(m[1])
  const n = Number(s)
  if (Number.isFinite(n) && n >= 1900 && n <= 2100) return n
  return null
}

function extractYearFromTitle(title) {
  const m = String(title).match(/\((\d{4})\)\s*$/)
  if (m) return Number(m[1])
  const m2 = String(title).match(/\b(19\d{2}|20\d{2})\b/)
  if (m2) return Number(m2[1])
  return null
}

function formatDurationSecs(secs) {
  if (!Number.isFinite(secs) || secs <= 0) return ''
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

function normalizeMovieDataRecord(raw) {
  if (raw == null) return {}
  if (typeof raw === 'string') {
    const t = raw.trim()
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try {
        return normalizeMovieDataRecord(JSON.parse(t))
      } catch {
        return {}
      }
    }
    return {}
  }
  if (Array.isArray(raw)) {
    return normalizeMovieDataRecord(raw[0])
  }
  return typeof raw === 'object' ? toRecord(raw) : {}
}

const VOD_PLOT_FIELD_SKIP = new Set(
  [
    'stream_id',
    'id',
    'name',
    'title',
    'cover',
    'movie_image',
    'stream_icon',
    'icon',
    'backdrop_path',
    'rating',
    'rating_5based',
    'genre',
    'genres',
    'director',
    'cast',
    'youtube_trailer',
    'trailer',
    'releaseDate',
    'release_date',
    'releasedate',
    'duration',
    'duration_secs',
    'container_extension',
    'custom_sid',
    'imdb_id',
    'tmdb_id',
    'category_id',
    'category_ids',
    'country',
    'year',
    'added',
    'season',
    'episode_num',
  ].map((k) => k.toLowerCase()),
)

const VOD_SCRAPE_PLOT_MIN_LEN = 24

function scrapeLongestPlotLikeString(...blocks) {
  let best = ''
  for (const block of blocks) {
    for (const [k, v] of Object.entries(block)) {
      if (VOD_PLOT_FIELD_SKIP.has(k.toLowerCase())) continue
      const s = readString(v).trim()
      if (s.length < VOD_SCRAPE_PLOT_MIN_LEN) continue
      if (/^https?:\/\//i.test(s)) continue
      if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) continue
      if (s.length > best.length) best = s
    }
  }
  return best
}

function extractVodPlotFromBlocks(info, movieData, vod, tmdb, root) {
  return firstNonEmpty(
    readString(
      info.plot ??
        info.description ??
        info.overview ??
        info.synopsis ??
        info.storyline ??
        info.msg ??
        info.body ??
        info.about ??
        info.summary ??
        info.notes ??
        info.sinopse ??
        info.enredo ??
        info.text ??
        info.content ??
        info.full_plot ??
        info.plot_outline ??
        info.memo ??
        info.long_description ??
        info.longDescription ??
        info.desc ??
        info.comment ??
        info.biography ??
        info.details,
    ),
    readString(
      movieData.plot ??
        movieData.description ??
        movieData.overview ??
        movieData.sinopse ??
        movieData.enredo ??
        movieData.text ??
        movieData.content ??
        movieData.long_description ??
        movieData.longDescription ??
        movieData.desc ??
        movieData.comment,
    ),
    readString(
      vod.plot ?? vod.description ?? vod.overview ?? vod.long_description ?? vod.longDescription ?? vod.comment,
    ),
    readString(tmdb.overview ?? tmdb.plot ?? tmdb.description),
    readString(root.plot ?? root.description),
    scrapeLongestPlotLikeString(info, movieData, vod, tmdb),
  )
}

const VOD_DEEP_PLOT_SKIP_KEYS = new Set(
  [
    ...VOD_PLOT_FIELD_SKIP,
    'password',
    'username',
    'token',
    'secret',
    'stream_url',
    'direct_source',
    'url',
    'backdrop',
    'trailer',
    'youtube_trailer',
    'user_info',
    'server_info',
    'dns',
    'port',
    'https_port',
    'server_protocol',
    'timezone',
  ].map((k) => String(k).toLowerCase()),
)

function collectVodPlotLikeStringsFromUnknown(value, key, depth, out) {
  if (depth > 12) return
  const kl = String(key).toLowerCase()
  if (typeof value === 'string') {
    if (VOD_DEEP_PLOT_SKIP_KEYS.has(kl)) return
    const t = value.trim()
    if (t.length < 15) return
    if (/^https?:\/\//i.test(t)) return
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) return
    if (/^[A-Za-z0-9+/=\r\n]{120,}$/.test(t.replace(/\s/g, '')) && !/\.\s/.test(t)) return
    let score = t.length
    if (
      /plot|desc|synopsis|overview|sinopse|storyline|summary|about|body|content|informa|enredo|memo|nota|texto|biografia/i.test(
        key,
      )
    ) {
      score += 50000
    }
    out.push({ text: t, score })
    return
  }
  if (value == null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectVodPlotLikeStringsFromUnknown(value[i], `${key}[${i}]`, depth + 1, out)
    }
    return
  }
  if (kl === 'password' || kl === 'user_info' || kl === 'server_info') return
  for (const [k, v] of Object.entries(value)) {
    collectVodPlotLikeStringsFromUnknown(v, k, depth + 1, out)
  }
}

function deepExtractVodPlotFromRawJson(json) {
  const scored = []
  collectVodPlotLikeStringsFromUnknown(json, 'root', 0, scored)
  if (scored.length === 0) return ''
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.text ?? ''
}

function flattenVodInfoRootMovieWrapper(root) {
  const m = root.movie
  if (m == null || typeof m !== 'object' || Array.isArray(m)) return root
  const mr = toRecord(m)
  if (Object.keys(mr).length === 0) return root
  return {
    ...root,
    info: root.info ?? mr.info,
    movie_data: root.movie_data ?? mr.movie_data,
    vod: root.vod ?? mr.vod,
    plot: root.plot ?? mr.plot,
    description: root.description ?? mr.description,
  }
}

export function parseVodInfoJson(json) {
  const root = flattenVodInfoRootMovieWrapper(toRecord(json))
  let info = normalizeMovieDataRecord(root.info)
  let movieData = normalizeMovieDataRecord(root.movie_data)
  const vod = normalizeMovieDataRecord(root.vod)
  if (!Object.keys(info).length && root.data != null) {
    const data = toRecord(root.data)
    info = normalizeMovieDataRecord(data.info ?? data)
    if (!Object.keys(movieData).length) {
      movieData = normalizeMovieDataRecord(data.movie_data)
    }
  }
  const tmdb = toRecord(
    info.tmdb_details ?? info.tmdb ?? movieData.tmdb_details ?? movieData.tmdb ?? root.tmdb_details ?? root.tmdb,
  )
  const hasPayload =
    Object.keys(info).length > 0 ||
    Object.keys(movieData).length > 0 ||
    Object.keys(vod).length > 0 ||
    readString(root.plot).trim().length > 0 ||
    readString(root.description).trim().length > 0
  if (!hasPayload) return null

  const plot = extractVodPlotFromBlocks(info, movieData, vod, tmdb, root)
  const genre = firstNonEmpty(readString(info.genre ?? info.genres), readString(movieData.genre))
  const rating = firstNonEmpty(
    readString(info.rating ?? info.rating_5based),
    readString(movieData.rating),
  )
  const cast = readString(info.cast)
  const director = readString(info.director)
  const releaseDate = readString(
    info.releaseDate ?? info.release_date ?? movieData.releaseDate ?? movieData.release_date,
  )
  const durationSecs = readOptionalNumber(info.duration_secs ?? info.duration ?? movieData.duration)
  const durationRaw = readString(info.duration ?? movieData.duration)
  const durationLabel =
    durationSecs != null && durationSecs > 0 ? formatDurationSecs(durationSecs) : durationRaw || ''
  const movie_image = firstNonEmpty(
    readString(info.movie_image ?? info.cover ?? info.cover_big),
    readString(movieData.movie_image ?? movieData.cover),
  )
  const name = firstNonEmpty(readString(info.name), readString(movieData.name), readString(vod.name))
  let year =
    parseReleaseYear(releaseDate) ??
    extractYearFromTitle(name) ??
    extractYearFromTitle(readString(movieData.name))
  if (year == null) year = new Date().getFullYear()
  const plotFinal = String(plot).trim() ? plot : deepExtractVodPlotFromRawJson(json)
  return {
    plot: plotFinal,
    cast,
    director,
    genre,
    rating,
    releaseDate,
    durationLabel,
    movie_image: movie_image || undefined,
    year,
  }
}

export function parseSeriesInfoMetaJson(json) {
  const root = toRecord(json)
  const info = toRecord(root.info)
  const data = root.data != null ? toRecord(root.data) : {}
  const tmdb = toRecord(info.tmdb_details ?? info.tmdb ?? data.tmdb_details ?? data.tmdb)
  const plot = firstNonEmpty(
    readString(
      info.plot ??
        info.description ??
        info.overview ??
        info.synopsis ??
        info.storyline ??
        info.msg ??
        info.body ??
        info.about ??
        info.sinopse ??
        info.enredo,
    ),
    readString(data.plot ?? data.description ?? data.overview ?? data.sinopse),
    readString(tmdb.overview ?? tmdb.plot ?? tmdb.description),
    readString(root.plot ?? root.description),
  )
  const genre = firstNonEmpty(readString(info.genre ?? info.genres), readString(data.genre))
  const rating = firstNonEmpty(readString(info.rating ?? info.rating_5based), readString(data.rating))
  const cover = firstNonEmpty(
    readString(info.cover ?? info.cover_big ?? info.movie_image),
    readString(data.cover),
  )
  const releaseDate = readString(info.releaseDate ?? info.release_date ?? data.releaseDate)
  const name = readString(info.name ?? root.name)
  let year =
    parseReleaseYear(releaseDate) ??
    extractYearFromTitle(name) ??
    extractYearFromTitle(readString(root.name))
  if (year == null) year = new Date().getFullYear()
  return { plot, genre, rating, year, cover: cover || undefined }
}

export async function resolveMoviesVodInfoFromRequest(query) {
  const sourceType = String(query.sourceType ?? '').trim()
  if (sourceType !== 'xtream') return null
  const vodId = Number(query.vodId ?? query.vod_id)
  if (!Number.isFinite(vodId)) return null
  const baseUrl = String(query.baseUrl ?? '').trim()
  const username = String(query.username ?? '').trim()
  const password = String(query.password ?? '')
  if (!baseUrl || !username || !password) return null
  try {
    const json = await xtreamGetVodInfo(baseUrl, username, password, vodId)
    return parseVodInfoJson(json)
  } catch {
    return null
  }
}

export async function resolveSeriesDetailFromRequest(query) {
  const sourceType = String(query.sourceType ?? '').trim()
  if (sourceType !== 'xtream') return null
  const seriesId = Number(query.seriesId ?? query.series_id)
  if (!Number.isFinite(seriesId)) return null
  const baseUrl = String(query.baseUrl ?? '').trim()
  const username = String(query.username ?? '').trim()
  const password = String(query.password ?? '')
  if (!baseUrl || !username || !password) return null
  try {
    const json = await xtreamGetSeriesInfo(baseUrl, username, password, seriesId)
    return parseSeriesInfoMetaJson(json)
  } catch {
    return null
  }
}

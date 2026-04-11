function trimTrailingSlashes(s) {
  return String(s ?? '').replace(/\/+$/, '')
}

export function buildPlayerApiUrl(baseUrl, username, password, action) {
  const base = trimTrailingSlashes(baseUrl)
  const u = encodeURIComponent(username)
  const p = encodeURIComponent(password)
  return `${base}/player_api.php?username=${u}&password=${p}&action=${encodeURIComponent(action)}`
}

export function buildLiveStreamHlsUrl(baseUrl, username, password, streamId) {
  const base = trimTrailingSlashes(baseUrl)
  const u = encodeURIComponent(username)
  const p = encodeURIComponent(password)
  return `${base}/live/${u}/${p}/${streamId}.m3u8`
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function iptvHeaders(url) {
  try {
    const origin = new URL(url).origin
    return {
      'User-Agent': BROWSER_UA,
      Referer: `${origin}/`,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  } catch {
    return { 'User-Agent': BROWSER_UA }
  }
}

async function xtreamFetchJson(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: iptvHeaders(url) })
  if (!res.ok) {
    const hint = await res.text().catch(() => '')
    throw new Error(`Xtream HTTP ${res.status}${hint ? ` — ${hint.slice(0, 200)}` : ''}`)
  }
  return res.json()
}

export async function xtreamGetLiveCategories(baseUrl, username, password) {
  const url = buildPlayerApiUrl(baseUrl, username, password, 'get_live_categories')
  const data = await xtreamFetchJson(url)
  if (!Array.isArray(data)) {
    throw new Error('get_live_categories: invalid response')
  }
  return data
}

export async function xtreamGetLiveStreams(baseUrl, username, password) {
  const url = buildPlayerApiUrl(baseUrl, username, password, 'get_live_streams')
  const data = await xtreamFetchJson(url)
  if (!Array.isArray(data)) {
    throw new Error('get_live_streams: invalid response')
  }
  return data
}

export async function xtreamGetVodCategories(baseUrl, username, password) {
  const url = buildPlayerApiUrl(baseUrl, username, password, 'get_vod_categories')
  const data = await xtreamFetchJson(url)
  if (!Array.isArray(data)) {
    throw new Error('get_vod_categories: invalid response')
  }
  return data
}

export async function xtreamGetVodStreams(baseUrl, username, password) {
  const url = buildPlayerApiUrl(baseUrl, username, password, 'get_vod_streams')
  const data = await xtreamFetchJson(url)
  if (!Array.isArray(data)) {
    throw new Error('get_vod_streams: invalid response')
  }
  return data
}

export async function xtreamGetSeriesCategories(baseUrl, username, password) {
  const url = buildPlayerApiUrl(baseUrl, username, password, 'get_series_categories')
  const data = await xtreamFetchJson(url)
  if (!Array.isArray(data)) {
    throw new Error('get_series_categories: invalid response')
  }
  return data
}

export async function xtreamGetSeries(baseUrl, username, password) {
  const url = buildPlayerApiUrl(baseUrl, username, password, 'get_series')
  const data = await xtreamFetchJson(url)
  if (!Array.isArray(data)) {
    throw new Error('get_series: invalid response')
  }
  return data
}

export async function xtreamGetVodInfo(baseUrl, username, password, vodId) {
  const base = buildPlayerApiUrl(baseUrl, username, password, 'get_vod_info')
  const url = `${base}&vod_id=${encodeURIComponent(String(vodId))}`
  return xtreamFetchJson(url)
}

export async function xtreamGetSeriesInfo(baseUrl, username, password, seriesId) {
  const base = buildPlayerApiUrl(baseUrl, username, password, 'get_series_info')
  const url = `${base}&series_id=${encodeURIComponent(String(seriesId))}`
  return xtreamFetchJson(url)
}

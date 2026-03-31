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

async function xtreamFetchJson(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'follow' })
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

import { parseM3uText } from './m3uParser.mjs'
import {
  buildM3uCategoriesFromGroups,
  resolveM3uCategoryId,
  stableM3uChannelId,
  LIVE_ALL_CATEGORY_ID,
  LIVE_UNCATEGORIZED_ID,
} from './liveMappers.mjs'
import {
  buildLiveStreamHlsUrl,
  xtreamGetLiveCategories,
  xtreamGetLiveStreams,
} from './xtreamApi.mjs'
import { filterXtreamLiveCatalogForTv } from './xtreamLiveTvFilter.mjs'
import { filterM3uEntriesForLive } from './m3uLiveFilter.mjs'
import { normalizeLiveStreamUrl } from '../utils/normalizeLiveStreamUrl.mjs'

const IPTV_UA = 'VLC/3.0.20 LibVLC/3.0.20'

async function fetchM3uText(url) {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': IPTV_UA },
  })
  if (!res.ok) {
    const hint = await res.text().catch(() => '')
    throw new Error(`M3U fetch failed: ${res.status}${hint ? ` — ${hint.slice(0, 200)}` : ''}`)
  }
  return res.text()
}

async function resolveM3uCatalog(m3uUrl) {
  const raw = await fetchM3uText(m3uUrl)
  const entries = filterM3uEntriesForLive(parseM3uText(raw))
  const hasUncategorized = entries.some((e) => !String(e.groupTitle ?? '').trim())
  const groupNames = entries
    .map((e) => String(e.groupTitle ?? '').trim())
    .filter(Boolean)

  const categories = buildM3uCategoriesFromGroups(groupNames, hasUncategorized)
  const channels = entries.map((e, index) => ({
    id: stableM3uChannelId(index, e.url, e.name),
    name: e.name,
    logo: String(e.tvgLogo ?? '').trim(),
    categoryId: resolveM3uCategoryId(e.groupTitle),
    streamUrl: normalizeLiveStreamUrl(String(e.url ?? '').trim()),
    sourceType: 'm3u',
    originalSourceId: String(index),
    epgChannelId: e.tvgId,
    isLive: true,
    number: index + 1,
  }))

  return {
    categories,
    channels,
    sourceType: 'm3u',
    loadedAt: Date.now(),
  }
}

function pickXtreamStreamUrl(baseUrl, username, password, row) {
  const direct = String(row.direct_source ?? '').trim()
  if (direct && /^[a-z][a-z0-9+.-]*:\/\//i.test(direct)) {
    return normalizeLiveStreamUrl(direct)
  }
  return buildLiveStreamHlsUrl(baseUrl, username, password, row.stream_id)
}

async function resolveXtreamCatalog(baseUrl, username, password) {
  const [catRowsRaw, streamRowsRaw] = await Promise.all([
    xtreamGetLiveCategories(baseUrl, username, password),
    xtreamGetLiveStreams(baseUrl, username, password),
  ])
  const { categories: catRows, streams: streamRows } = filterXtreamLiveCatalogForTv(
    catRowsRaw,
    streamRowsRaw,
  )

  const known = new Set(catRows.map((c) => `xt-cat:${String(c.category_id)}`))
  const needsUncategorized = streamRows.some((s) => {
    const raw = s.category_id != null ? String(s.category_id) : ''
    return !raw || !known.has(`xt-cat:${raw}`)
  })

  const categories = [
    { id: LIVE_ALL_CATEGORY_ID, name: 'Todos', order: 0 },
    ...catRows.map((c, i) => ({
      id: `xt-cat:${String(c.category_id)}`,
      name: c.category_name,
      order: i + 1,
    })),
  ]
  if (needsUncategorized) {
    categories.push({
      id: LIVE_UNCATEGORIZED_ID,
      name: 'Uncategorized',
      order: categories.length,
    })
  }

  const channels = streamRows.map((s, index) => {
    const raw = s.category_id != null ? String(s.category_id) : ''
    return {
      id: `xtream-${s.stream_id}`,
      name: String(s.name ?? '').trim() || `Channel ${s.stream_id}`,
      logo: String(s.stream_icon ?? '').trim(),
      categoryId: raw && known.has(`xt-cat:${raw}`) ? `xt-cat:${raw}` : LIVE_UNCATEGORIZED_ID,
      streamUrl: pickXtreamStreamUrl(baseUrl, username, password, s),
      sourceType: 'xtream',
      originalSourceId: String(s.stream_id),
      epgChannelId: s.epg_channel_id ?? undefined,
      isLive: true,
      number: index + 1,
    }
  })

  return {
    categories,
    channels,
    sourceType: 'xtream',
    loadedAt: Date.now(),
  }
}

export async function resolveLiveCatalogFromRequest(query) {
  const sourceType = String(query.sourceType ?? '').trim()
  if (sourceType === 'm3u') {
    const m3uUrl = String(query.m3uUrl ?? '').trim()
    if (!m3uUrl) {
      return { categories: [], channels: [], sourceType: 'none', loadedAt: Date.now() }
    }
    return resolveM3uCatalog(m3uUrl)
  }
  if (sourceType === 'xtream') {
    const baseUrl = String(query.baseUrl ?? '').trim()
    const username = String(query.username ?? '').trim()
    const password = String(query.password ?? '')
    if (!baseUrl || !username || !password) {
      return { categories: [], channels: [], sourceType: 'none', loadedAt: Date.now() }
    }
    return resolveXtreamCatalog(baseUrl, username, password)
  }
  return { categories: [], channels: [], sourceType: 'none', loadedAt: Date.now() }
}

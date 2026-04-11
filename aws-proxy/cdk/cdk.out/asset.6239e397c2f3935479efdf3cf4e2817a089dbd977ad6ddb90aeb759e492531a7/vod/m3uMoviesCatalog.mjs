/** Alinhado a `normalizeCategoryDisplayName` com flag desligada no cliente. */
function normalizeCategoryDisplayName(name) {
  return String(name ?? '').trim()
}

function extensionFromUrl(url) {
  try {
    const path = new URL(url).pathname
    const m = path.match(/\.([a-z0-9]+)$/i)
    return m ? m[1].toLowerCase() : 'mp4'
  } catch {
    return 'mp4'
  }
}

/**
 * Igual a `buildM3uVodMovieCatalog` — categorias/streams estilo Xtream + URLs por stream_id.
 */
export function buildM3uVodMovieCatalog(entries) {
  const rawGroups = [
    ...new Set(entries.map((e) => String(e.groupTitle ?? 'Movies').trim() || 'Movies')),
  ]
  const categories = rawGroups.map((name, i) => ({
    category_id: `m3u-${i}`,
    category_name: normalizeCategoryDisplayName(name),
  }))
  const rawToId = new Map(rawGroups.map((n, i) => [n, `m3u-${i}`]))

  const streams = entries.map((e, idx) => {
    const raw = String(e.groupTitle ?? 'Movies').trim() || 'Movies'
    return {
      stream_id: idx + 1,
      name: e.name,
      stream_icon: e.tvgLogo?.trim() ? e.tvgLogo : undefined,
      category_id: rawToId.get(raw) ?? 'm3u-0',
      container_extension: extensionFromUrl(e.url),
    }
  })

  const m3uStreamUrls = {}
  for (let i = 0; i < entries.length; i++) {
    m3uStreamUrls[String(i + 1)] = String(entries[i].url ?? '').trim()
  }

  return { categories, streams, m3uStreamUrls }
}

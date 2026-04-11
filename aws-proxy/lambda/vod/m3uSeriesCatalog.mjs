function normalizeCategoryDisplayName(name) {
  return String(name ?? '').trim()
}

/**
 * Lista de séries estilo Xtream a partir de entradas M3U filtradas.
 */
export function buildM3uSeriesCatalog(entries) {
  const rawGroups = [
    ...new Set(entries.map((e) => String(e.groupTitle ?? 'Series').trim() || 'Series')),
  ]
  const categories = rawGroups.map((name, i) => ({
    category_id: `m3u-${i}`,
    category_name: normalizeCategoryDisplayName(name),
  }))
  const rawToId = new Map(rawGroups.map((n, i) => [n, `m3u-${i}`]))

  const series = entries.map((e, idx) => {
    const raw = String(e.groupTitle ?? 'Series').trim() || 'Series'
    return {
      series_id: idx + 1,
      name: e.name,
      cover: e.tvgLogo?.trim() ? e.tvgLogo : undefined,
      category_id: rawToId.get(raw) ?? 'm3u-0',
    }
  })

  const m3uSeriesUrls = {}
  for (let i = 0; i < entries.length; i++) {
    m3uSeriesUrls[String(i + 1)] = String(entries[i].url ?? '').trim()
  }

  return { categories, series, m3uSeriesUrls }
}

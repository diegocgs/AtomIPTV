export const LIVE_ALL_CATEGORY_ID = 'lc-all'
export const LIVE_UNCATEGORIZED_ID = 'cat-uncategorized'

export function encodeCategoryIdFromGroup(name) {
  return `m3u-cat:${encodeURIComponent(String(name ?? '').trim())}`
}

export function buildM3uCategoriesFromGroups(groupNames, hasUncategorized) {
  const sorted = [...new Set(groupNames.filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const out = [{ id: LIVE_ALL_CATEGORY_ID, name: 'Todos', order: 0 }]
  sorted.forEach((name, i) => {
    out.push({ id: encodeCategoryIdFromGroup(name), name, order: i + 1 })
  })
  if (hasUncategorized) {
    out.push({
      id: LIVE_UNCATEGORIZED_ID,
      name: 'Uncategorized',
      order: sorted.length + 1,
    })
  }
  return dedupeCategories(out)
}

function dedupeCategories(cats) {
  const seen = new Set()
  return cats.filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })
}

export function resolveM3uCategoryId(groupTitle) {
  const g = String(groupTitle ?? '').trim()
  if (!g) return LIVE_UNCATEGORIZED_ID
  return encodeCategoryIdFromGroup(g)
}

export function stableM3uChannelId(index, url, name) {
  const slug = `${index}-${String(url).slice(0, 48)}-${String(name).slice(0, 24)}`
  let h = 0
  for (let i = 0; i < slug.length; i++) {
    h = (Math.imul(31, h) + slug.charCodeAt(i)) | 0
  }
  return `m3u-${Math.abs(h).toString(36)}-${index}`
}

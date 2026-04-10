import type { LiveCategory } from '../types/liveCatalog'

/** Categoria sintética “Todos”. */
export const LIVE_ALL_CATEGORY_ID = 'lc-all'

/** Categoria sintética “Favorites” (só canais marcados como favoritos). */
export const LIVE_FAVORITES_CATEGORY_ID = 'lc-favorites'

/** Streams sem grupo M3U / sem categoria Xtream. */
export const LIVE_UNCATEGORIZED_ID = 'cat-uncategorized'

/**
 * IDs estáveis para categorias derivadas de group-title M3U.
 */
export function encodeCategoryIdFromGroup(name: string): string {
  return `m3u-cat:${encodeURIComponent(name.trim())}`
}

export function buildM3uCategoriesFromGroups(
  groupNames: string[],
  hasUncategorized: boolean,
): LiveCategory[] {
  const ordered = [...new Set(groupNames.filter(Boolean))]
  const out: LiveCategory[] = [
    { id: LIVE_ALL_CATEGORY_ID, name: 'Todos', order: 0 },
  ]
  ordered.forEach((name, i) => {
    out.push({
      id: encodeCategoryIdFromGroup(name),
      name,
      order: i + 1,
    })
  })
  if (hasUncategorized) {
    out.push({
      id: LIVE_UNCATEGORIZED_ID,
      name: 'Uncategorized',
      order: ordered.length + 1,
    })
  }
  return dedupeCategories(out)
}

function dedupeCategories(cats: LiveCategory[]): LiveCategory[] {
  const seen = new Set<string>()
  return cats.filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })
}

export function resolveM3uCategoryId(groupTitle: string | undefined): string {
  const g = groupTitle?.trim()
  if (!g) return LIVE_UNCATEGORIZED_ID
  return encodeCategoryIdFromGroup(g)
}

export function stableM3uChannelId(index: number, url: string, name: string): string {
  const slug = `${index}-${url.slice(0, 48)}-${name.slice(0, 24)}`
  let h = 0
  for (let i = 0; i < slug.length; i++) {
    h = (Math.imul(31, h) + slug.charCodeAt(i)) | 0
  }
  return `m3u-${Math.abs(h).toString(36)}-${index}`
}

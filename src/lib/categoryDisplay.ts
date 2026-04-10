/**
 * When `true`, category labels strip the segment before the first colon, inclusive
 * (e.g. `"Filmes: Ação"` → `"Ação"`). Used by Live / Movies / Series sidebars and live channel maps.
 * Off by default — set to `true` to enable.
 */
export const ENABLE_CATEGORY_DISPLAY_NORMALIZATION = false;

/**
 * Applies {@link ENABLE_CATEGORY_DISPLAY_NORMALIZATION}. When disabled, returns `name` unchanged.
 */
export function normalizeCategoryDisplayName(name: string): string {
  if (!ENABLE_CATEGORY_DISPLAY_NORMALIZATION) {
    return name;
  }
  const s = name.trim();
  const i = s.indexOf(':');
  if (i < 0) return s;
  return s.slice(i + 1).trim();
}

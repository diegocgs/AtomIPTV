import { normalizeCategoryDisplayName } from '@/lib/categoryDisplay';
import type { M3uEntry } from '@/services/m3u';
import type { XtreamVodCategory, XtreamVodStream } from '@/services/xtream';

function extensionFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : 'mp4';
  } catch {
    return 'mp4';
  }
}

/**
 * Converte entradas M3U (filmes) no mesmo formato que a página Movies usa com Xtream,
 * mais um mapa `stream_id` → URL real da lista.
 */
export function buildM3uVodMovieCatalog(entries: M3uEntry[]): {
  categories: XtreamVodCategory[];
  streams: XtreamVodStream[];
  streamIdToUrl: Map<number, string>;
} {
  const rawGroups = [...new Set(entries.map(e => (e.groupTitle || 'Movies').trim() || 'Movies'))];
  const categories: XtreamVodCategory[] = rawGroups.map((name, i) => ({
    category_id: `m3u-${i}`,
    category_name: normalizeCategoryDisplayName(name),
  }));
  const rawToId = new Map(rawGroups.map((n, i) => [n, `m3u-${i}`]));

  const streams: XtreamVodStream[] = entries.map((e, idx) => {
    const raw = (e.groupTitle || 'Movies').trim() || 'Movies';
    return {
      stream_id: idx + 1,
      name: e.name,
      stream_icon: e.tvgLogo?.trim() ? e.tvgLogo : undefined,
      category_id: rawToId.get(raw) ?? 'm3u-0',
      container_extension: extensionFromUrl(e.url),
    };
  });

  const streamIdToUrl = new Map<number, string>(entries.map((e, i) => [i + 1, e.url]));

  return { categories, streams, streamIdToUrl };
}

import { type M3uEntry } from '@/services/m3u';
import {
  isLiveTvSectionLabelExcluded,
  isLiveTvSectionLabelStrongExcluded,
} from '@/lib/liveTvSectionLabelFilter';

/** Linha compacta guardada no IndexedDB (só Live TV — sem VOD/séries misturados). */
export type M3uLiveCompactRow = {
  n: string;
  u: string;
  g: string;
  l?: string;
  i?: string;
};

const MOVIE_PATH = /\/movie\//i;
const MOVIES_PATH = /\/movies\//i;
const SERIES_PATH = /\/series\//i;
const SERIE_PATH = /\/serie\//i;
const SEASON_PATH = /\/season\//i;
const EPISODE_PATH = /\/episodes?\//i;
const LIVE_PATH = /\/live\//i;
const VOD_PATH = /\/vod\//i;
const VIDEO_FILE = /\.(mp4|mkv|avi|mov|wmv|flv|webm|mpg|mpeg|m4v)(\?|#|$)/i;
const HLS_MANIFEST = /\.m3u8(\?|#|$)/i;

const SERIES_GROUP_HINT = /\b(series|seriados?|tv shows?|s\d{1,2}\s*e\d{1,2}|temporada|season\s*\d+)\b/i;
const MOVIE_GROUP_HINT = /\b(vod|movie|movies|films?|4k[\s-]?movies?|uhd)\b/i;

function groupSuggestsVodOrSeries(groupTitle: string): boolean {
  const s = groupTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  return /\b(vod|season|seasons|episode|episodes|box[\s-]?sets?|on[\s-]*demand|biblioteca|library)\b/.test(s)
}

function hasExplicitNonLivePath(url: string): boolean {
  return (
    MOVIE_PATH.test(url) ||
    MOVIES_PATH.test(url) ||
    VOD_PATH.test(url) ||
    SERIES_PATH.test(url) ||
    SERIE_PATH.test(url) ||
    SEASON_PATH.test(url) ||
    EPISODE_PATH.test(url)
  );
}

function titleSuggestsSeriesEpisode(name: string): boolean {
  return /\bS\d{1,2}\s*[EeXx]\s*\d{1,3}\b/.test(name);
}

/**
 * Heurística alinhada a listas Xtream/Code: `/live/` vs `/movie/` vs `/series/`,
 * extensões de ficheiro de vídeo e group-title típicos de VOD/séries.
 *
 * Importante: muitas listas usam `.../live/user/pass/id` também para bibliotecas VOD;
 * por isso **group-title** (ex.: "Streaming: Netflix") deve filtrar *antes* de aceitar só por `/live/`.
 */
export function filterM3uEntriesForLive(entries: M3uEntry[]): M3uEntry[] {
  const groupIsVodLike = (groupTitle: string | undefined): boolean =>
    isLiveTvSectionLabelExcluded(String(groupTitle ?? '').trim())
  const groupIsStrongVodLike = (groupTitle: string | undefined): boolean =>
    isLiveTvSectionLabelStrongExcluded(String(groupTitle ?? '').trim())

  const passesUrlShape = (e: M3uEntry): boolean => {
    const u = e.url.trim();
    if (!u) return false;
    if (hasExplicitNonLivePath(u)) return false;
    if (VIDEO_FILE.test(u)) return false;
    return true;
  }

  const filtered = entries.filter(e => {
    if (!passesUrlShape(e)) return false;
    const u = e.url.trim();
    if (groupIsStrongVodLike(e.groupTitle)) return false;
    const supportingNonLive =
      groupIsVodLike(e.groupTitle) ||
      groupSuggestsVodOrSeries(e.groupTitle) ||
      titleSuggestsSeriesEpisode(e.name);
    if (supportingNonLive) return false;
    if (LIVE_PATH.test(u)) return true;
    return true;
  })

  if (filtered.length > 0) return filtered

  const hasLiveUrl = entries.some(e => LIVE_PATH.test(e.url.trim()))
  const structuralKeep = entries.filter((e) => {
    const u = e.url.trim()
    return Boolean(u) && !hasExplicitNonLivePath(u) && !VIDEO_FILE.test(u)
  })
  /** Lista sem padrão `/live/` (URLs atípicas): manter fallback para não esvaziar Live por engano. */
  if (!hasLiveUrl && entries.length > 0) {
    if (structuralKeep.length > 0 && structuralKeep.length < entries.length) return structuralKeep
    return entries
  }
  /** Só havia `/live/` mas tudo era VOD por grupo — não repor a lista completa. */
  return []
}

export function m3uEntriesToCompactLiveRows(entries: M3uEntry[]): M3uLiveCompactRow[] {
  return entries.map(e => ({
    n: e.name,
    u: e.url,
    g: e.groupTitle || 'Live',
    ...(e.tvgLogo ? { l: e.tvgLogo } : {}),
    ...(e.tvgId ? { i: e.tvgId } : {}),
  }));
}

export function compactLiveRowsToM3uEntries(rows: M3uLiveCompactRow[]): M3uEntry[] {
  return rows.map(r => ({
    name: r.n,
    url: r.u,
    groupTitle: r.g,
    tvgLogo: r.l,
    tvgId: r.i,
  }));
}

/**
 * Entradas de filme / VOD em listas M3U “seca” (sem API Xtream).
 * Complementar a `filterM3uEntriesForLive`: não inclui canais live nem séries.
 */
export function filterM3uEntriesForVodMovies(entries: M3uEntry[]): M3uEntry[] {
  const pick = (list: M3uEntry[]): M3uEntry[] =>
    list.filter(e => {
      const u = e.url.trim();
      if (!u) return false;
      if (SERIES_PATH.test(u)) return false;
      if (LIVE_PATH.test(u) && !MOVIE_PATH.test(u) && !VOD_PATH.test(u) && !HLS_MANIFEST.test(u)) {
        return false;
      }
      if (MOVIE_PATH.test(u) || VOD_PATH.test(u)) return true;
      if (VIDEO_FILE.test(u)) return true;
      if (HLS_MANIFEST.test(u)) {
        if (LIVE_PATH.test(u)) return false;
        const g = (e.groupTitle || '').toLowerCase();
        if (SERIES_GROUP_HINT.test(g)) return false;
        if (MOVIE_GROUP_HINT.test(g)) return true;
        if (groupSuggestsVodOrSeries(e.groupTitle) && MOVIE_GROUP_HINT.test(g)) return true;
        return false;
      }
      const g = (e.groupTitle || '').toLowerCase();
      if (MOVIE_GROUP_HINT.test(g) && !SERIES_GROUP_HINT.test(g)) return true;
      return false;
    });

  const primary = pick(entries);
  if (primary.length > 0) return primary;

  /** Listas com group-title genérico: ainda assim URLs /movie/, ficheiro ou HLS fora de /live/. */
  return entries.filter(e => {
    const u = e.url.trim();
    if (!u || SERIES_PATH.test(u)) return false;
    if (MOVIE_PATH.test(u) || VOD_PATH.test(u)) return true;
    if (VIDEO_FILE.test(u)) return true;
    return HLS_MANIFEST.test(u) && !LIVE_PATH.test(u);
  });
}

/**
 * Entradas de séries em M3U sem API Xtream (`/series/`, group-title, ou título tipo S01E05).
 * Exclui URLs claramente de filme (`/movie/`) sem `/series/`.
 */
export function filterM3uEntriesForSeries(entries: M3uEntry[]): M3uEntry[] {
  const primary = entries.filter(e => {
    const u = e.url.trim();
    if (!u) return false;
    if (MOVIE_PATH.test(u) && !SERIES_PATH.test(u)) return false;
    if (SERIES_PATH.test(u)) return true;
    if (LIVE_PATH.test(u) && !SERIES_PATH.test(u)) return false;
    const g = (e.groupTitle || '').toLowerCase();
    if (SERIES_GROUP_HINT.test(g) && !MOVIE_GROUP_HINT.test(g)) return true;
    if (/\b[Ss]\d{1,2}\s*[EeXx]\s*\d{1,3}\b/.test(e.name)) return true;
    return false;
  });
  if (primary.length > 0) return primary;
  return entries.filter(e => {
    const u = e.url.trim();
    return Boolean(u && SERIES_PATH.test(u));
  });
}

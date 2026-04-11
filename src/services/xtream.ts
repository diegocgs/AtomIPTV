import type { Channel } from '@/components/iptv/ChannelList';
import { normalizeCategoryDisplayName } from '@/lib/categoryDisplay';
import { xtreamUrlMatchesViteDevProxyTarget } from '@/lib/xtreamViteDevProxyTarget';
import { buildBackendProxyUrl, getBackendApiBase } from '@/lib/backendApi';
import { proxyClientGet } from '@/lib/proxyClientGet';
import { isSamsungTizenLikeRuntime } from '@/lib/tvFocus/tvRemoteKeys';

export interface XtreamCredentials {
  name: string;
  username: string;
  password: string;
  serverUrl: string;
  port?: string;
}

export interface XtreamConnectionResult {
  isAuthorized: boolean;
  status: string;
  expDate?: string;
  activeCons?: string;
  maxConnections?: string;
  liveStreamsCount: number;
}

export interface XtreamLiveCategory {
  category_id: string;
  category_name: string;
}

export interface XtreamLiveStream {
  num?: number;
  name: string;
  stream_type?: string | null;
  stream_id: number;
  stream_icon?: string;
  epg_channel_id?: string | null;
  category_id?: string | number | null;
  tv_archive?: number;
  /** Alguns painéis enviam extensão de ficheiro em linhas “live” que são na verdade VOD. */
  container_extension?: string | null;
  /**
   * Alguns painéis enviam URL pronta (`direct_source`, `stream_url` ou `url`).
   * Usar para playback em vez de montar `/live/user/pass/id.m3u8` quando existir.
   */
  playbackUrlFromApi?: string;
}

export interface XtreamVodCategory {
  category_id: string;
  category_name: string;
}

export interface XtreamVodStream {
  stream_id: number;
  name: string;
  stream_icon?: string;
  category_id?: string | number | null;
  added?: string | null;
  rating?: string | null;
  container_extension?: string | null;
  /** Campos opcionais enviados por muitos painéis Xtream */
  plot?: string | null;
  description?: string | null;
  /** Alguns painéis enviam sinopse só neste campo na lista VOD. */
  synopsis?: string | null;
  genre?: string | null;
  director?: string | null;
  cast?: string | null;
  releaseDate?: string | null;
  release_date?: string | null;
  year?: string | number | null;
  duration?: string | null;
  duration_secs?: string | number | null;
}

export interface XtreamSeriesCategory {
  category_id: string;
  category_name: string;
}

export interface XtreamSeriesStream {
  series_id: number;
  name: string;
  cover?: string;
  category_id?: string | number | null;
  last_modified?: string | null;
  rating?: string | null;
  plot?: string | null;
  description?: string | null;
  synopsis?: string | null;
  genre?: string | null;
  cast?: string | null;
  releaseDate?: string | null;
  release_date?: string | null;
  year?: string | number | null;
}

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value : value == null ? '' : String(value);

/** Ano a partir de releaseDate ISO ou string numérica (provider). */
export const parseReleaseYear = (value: string | null | undefined): number | null => {
  if (value == null || !String(value).trim()) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})/);
  if (m) return Number(m[1]);
  const n = Number(s);
  if (Number.isFinite(n) && n >= 1900 && n <= 2100) return n;
  return null;
};

/** Ex.: título "(A) Fronteira (2007)" → 2007 */
export const extractYearFromTitle = (title: string): number | null => {
  const m = title.match(/\((\d{4})\)\s*$/);
  if (m) return Number(m[1]);
  const m2 = title.match(/\b(19\d{2}|20\d{2})\b/);
  if (m2) return Number(m2[1]);
  return null;
};

export const formatDurationSecs = (secs: number): string => {
  if (!Number.isFinite(secs) || secs <= 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
};

const readOptionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Ano de exibição: release > campo year > ano no título > data de adição à lista. */
export const resolveXtreamVodYear = (stream: XtreamVodStream): number => {
  const fromRelease = parseReleaseYear(readString(stream.releaseDate ?? stream.release_date));
  if (fromRelease != null) return fromRelease;
  if (typeof stream.year === 'number' && stream.year >= 1900 && stream.year <= 2100) return stream.year;
  const yStr = parseReleaseYear(readString(stream.year));
  if (yStr != null) return yStr;
  const titleY = extractYearFromTitle(stream.name);
  if (titleY != null) return titleY;
  const added = stream.added ? Number(stream.added) : NaN;
  if (Number.isFinite(added)) return new Date(added * 1000).getFullYear();
  return new Date().getFullYear();
};

export const resolveXtreamVodDurationLabel = (stream: XtreamVodStream): string => {
  const secs = readOptionalNumber(stream.duration_secs);
  if (secs != null && secs > 0) return formatDurationSecs(secs);
  const d = readString(stream.duration);
  if (d) return d;
  return '';
};

const firstNonEmpty = (...parts: (string | null | undefined)[]): string => {
  for (const p of parts) {
    const t = p?.trim();
    if (t) return t;
  }
  return '';
};

export const resolveXtreamVodPlot = (stream: XtreamVodStream): string =>
  firstNonEmpty(stream.plot, stream.description, stream.synopsis);

/** Género do provider ou nome da categoria. */
export const resolveXtreamVodGenre = (stream: XtreamVodStream, categoryName: string): string => {
  const g = readString(stream.genre);
  if (g) return g;
  return categoryName || 'VOD';
};

export const resolveXtreamSeriesYear = (stream: XtreamSeriesStream): number => {
  const fromRelease = parseReleaseYear(readString(stream.releaseDate ?? stream.release_date));
  if (fromRelease != null) return fromRelease;
  if (typeof stream.year === 'number' && stream.year >= 1900 && stream.year <= 2100) return stream.year;
  const yStr = parseReleaseYear(readString(stream.year));
  if (yStr != null) return yStr;
  const titleY = extractYearFromTitle(stream.name);
  if (titleY != null) return titleY;
  const modified = stream.last_modified ? Number(stream.last_modified) : NaN;
  if (Number.isFinite(modified)) return new Date(modified * 1000).getFullYear();
  return new Date().getFullYear();
};

export const resolveXtreamSeriesPlot = (stream: XtreamSeriesStream): string =>
  firstNonEmpty(stream.plot, stream.description, stream.synopsis);

export const resolveXtreamSeriesGenre = (stream: XtreamSeriesStream, categoryName: string): string => {
  const g = readString(stream.genre);
  if (g) return g;
  return categoryName || 'Series';
};

export const normalizeServerUrl = (serverUrl: string, port?: string): string => {
  const trimmed = serverUrl.trim().replace(/\/+$/, '');
  if (!port?.trim()) return trimmed;

  const hasExplicitPort = /:\d+$/.test(trimmed);
  return hasExplicitPort ? trimmed : `${trimmed}:${port.trim()}`;
};

/**
 * URL base do painel (sem `/live` / `player_api.php`).
 * Em dev as chamadas a `player_api.php` passam por `/api/proxy` em `xtreamFetch` (corpo JSON grande);
 * com fallback para `/xtream` se o fetch falhar e o painel for o alvo dev em `xtreamViteDevProxyTarget.ts`.
 */
export const getXtreamBaseUrl = (credentials: XtreamCredentials): string => {
  return normalizeServerUrl(credentials.serverUrl, credentials.port);
};

const hasExplicitPort = (baseUrl: string): boolean => {
  try {
    const u = new URL(baseUrl);
    return u.port.trim().length > 0;
  } catch {
    return /:\d+$/.test(baseUrl);
  }
};

/**
 * Some providers only answer API requests on non-default ports (often :8080).
 * If user did not set a port explicitly, try common panel ports as fallback.
 */
const getXtreamBaseUrlCandidates = (credentials: XtreamCredentials): string[] => {
  const base = getXtreamBaseUrl(credentials).replace(/\/+$/, '');
  if (hasExplicitPort(base)) return [base];
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    return [base];
  }
  const ports = parsed.protocol === 'https:' ? ['443'] : ['80', '8080'];
  const out = new Set<string>([base]);
  for (const p of ports) {
    const u = new URL(parsed.toString());
    u.port = p;
    out.add(u.toString().replace(/\/+$/, ''));
  }
  return [...out];
};

const toAbsoluteStreamUrl = (relative: string): string => {
  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative;
  }
  if (typeof globalThis !== 'undefined' && 'location' in globalThis && globalThis.location?.origin) {
    return `${globalThis.location.origin}${relative}`;
  }
  return relative;
};

/** Xtream live stream URL (HLS). Em dev o playback costuma ir por `/api/hls-proxy` no cliente. */
export const buildXtreamLiveStreamUrl = (credentials: XtreamCredentials, streamId: number): string => {
  assertXtreamCredentialsComplete(credentials);
  const base = getXtreamBaseUrl(credentials).replace(/\/+$/, '');
  /** Path com user/pass em texto — alinhado a players IPTV comuns; `encodeURIComponent` quebra alguns painéis. */
  const relative = `${base}/live/${credentials.username}/${credentials.password}/${streamId}.m3u8`;
  return toAbsoluteStreamUrl(relative);
};

/** VOD movie URL (`/movie/user/pass/id.ext`). */
export const buildXtreamVodStreamUrl = (
  credentials: XtreamCredentials,
  streamId: number,
  extension: string = 'mp4'
): string => {
  assertXtreamCredentialsComplete(credentials);
  const base = getXtreamBaseUrl(credentials).replace(/\/+$/, '');
  const ext = extension.replace(/^\./, '') || 'mp4';
  const relative = `${base}/movie/${credentials.username}/${credentials.password}/${streamId}.${ext}`;
  return toAbsoluteStreamUrl(relative);
};

/** Episódio de série (`/series/user/pass/id.ext`). */
export const buildXtreamSeriesStreamUrl = (
  credentials: XtreamCredentials,
  episodeId: number,
  extension: string = 'mp4'
): string => {
  assertXtreamCredentialsComplete(credentials);
  const base = getXtreamBaseUrl(credentials).replace(/\/+$/, '');
  const ext = extension.replace(/^\./, '') || 'mp4';
  const relative = `${base}/series/${credentials.username}/${credentials.password}/${episodeId}.${ext}`;
  return toAbsoluteStreamUrl(relative);
};

/** Episódio retornado por `get_series_info` para montar URL de play. */
export interface XtreamSeriesEpisodeLink {
  episodeId: number;
  extension: string;
  title: string;
}

const pushEpisodeRows = (rawList: unknown[], out: XtreamSeriesEpisodeLink[]) => {
  for (const raw of rawList) {
    const e = toRecord(raw);
    const episodeId = Number(e.id ?? e.stream_id);
    if (!Number.isFinite(episodeId)) continue;
    const ext = readString(e.container_extension).replace(/^\./, '') || 'mp4';
    out.push({
      episodeId,
      extension: ext,
      title: readString(e.title ?? e.name),
    });
  }
};

const collectSeriesEpisodesFromInfo = (json: unknown): XtreamSeriesEpisodeLink[] => {
  const root = toRecord(json);
  const out: XtreamSeriesEpisodeLink[] = [];
  const episodes =
    root.episodes ?? (root.data != null ? toRecord(root.data).episodes : undefined);
  if (Array.isArray(episodes)) {
    pushEpisodeRows(episodes, out);
    return out;
  }
  if (episodes && typeof episodes === 'object') {
    const seasonKeys = Object.keys(episodes as Record<string, unknown>).sort(
      (a, b) => Number(a) - Number(b)
    );
    for (const sk of seasonKeys) {
      const arr = (episodes as Record<string, unknown>)[sk];
      if (Array.isArray(arr)) pushEpisodeRows(arr, out);
    }
  }
  return out;
};

/** Metadados + episódios de `get_series_info`. */
export interface XtreamSeriesInfoResult {
  episodes: XtreamSeriesEpisodeLink[];
  plot: string;
  genre: string;
  rating: string;
  year: number;
  cover?: string;
}

const parseXtreamSeriesInfoResult = (json: unknown): XtreamSeriesInfoResult => {
  const episodes = collectSeriesEpisodesFromInfo(json);
  const root = toRecord(json);
  const info = toRecord(root.info);
  const data = root.data != null ? toRecord(root.data) : {};
  const tmdb = toRecord(info.tmdb_details ?? info.tmdb ?? data.tmdb_details ?? data.tmdb);
  const plot = firstNonEmpty(
    readString(
      info.plot ??
        info.description ??
        info.overview ??
        info.synopsis ??
        info.storyline ??
        info.msg ??
        info.body ??
        info.about ??
        info.sinopse ??
        info.enredo,
    ),
    readString(data.plot ?? data.description ?? data.overview ?? data.sinopse),
    readString(tmdb.overview ?? tmdb.plot ?? tmdb.description),
    readString(root.plot ?? root.description),
  );
  const genre = firstNonEmpty(readString(info.genre ?? info.genres), readString(data.genre));
  const rating = firstNonEmpty(
    readString(info.rating ?? info.rating_5based),
    readString(data.rating)
  );
  const cover = firstNonEmpty(
    readString(info.cover ?? info.cover_big ?? info.movie_image),
    readString(data.cover)
  );
  const releaseDate = readString(info.releaseDate ?? info.release_date ?? data.releaseDate);
  const name = readString(info.name ?? root.name);
  let year =
    parseReleaseYear(releaseDate) ??
    extractYearFromTitle(name) ??
    extractYearFromTitle(readString(root.name));
  if (year == null) year = new Date().getFullYear();
  return {
    episodes,
    plot,
    genre,
    rating,
    year,
    cover: cover || undefined,
  };
};

/** Detalhe VOD de `get_vod_info` (sinopse, elenco, etc.). */
export interface XtreamVodInfoDetail {
  plot: string;
  cast: string;
  director: string;
  genre: string;
  rating: string;
  releaseDate: string;
  durationLabel: string;
  movie_image?: string;
  year: number;
}

/** `movie_data` / `info` como objeto, 1.º elemento de array, ou string JSON. */
const normalizeMovieDataRecord = (raw: unknown): Record<string, unknown> => {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    const t = raw.trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try {
        return normalizeMovieDataRecord(JSON.parse(t) as unknown);
      } catch {
        return {};
      }
    }
    return {};
  }
  if (Array.isArray(raw)) {
    const first = raw[0];
    return normalizeMovieDataRecord(first);
  }
  return typeof raw === 'object' ? toRecord(raw) : {};
};

const VOD_PLOT_FIELD_SKIP = new Set(
  [
    'stream_id',
    'id',
    'name',
    'title',
    'cover',
    'movie_image',
    'stream_icon',
    'icon',
    'backdrop_path',
    'rating',
    'rating_5based',
    'genre',
    'genres',
    'director',
    'cast',
    'youtube_trailer',
    'trailer',
    'releaseDate',
    'release_date',
    'releasedate',
    'duration',
    'duration_secs',
    'container_extension',
    'custom_sid',
    'imdb_id',
    'tmdb_id',
    'category_id',
    'category_ids',
    'country',
    'year',
    'added',
    'season',
    'episode_num',
  ].map((k) => k.toLowerCase()),
);

/** Mínimo para heurística de “texto de sinopse” em campos não mapeados (sinopses reais costumam ser maiores). */
const VOD_SCRAPE_PLOT_MIN_LEN = 24;

/** Último recurso: maior string “narrativa” em blocos do painel (campos desconhecidos). */
const scrapeLongestPlotLikeString = (...blocks: Record<string, unknown>[]): string => {
  let best = '';
  for (const block of blocks) {
    for (const [k, v] of Object.entries(block)) {
      if (VOD_PLOT_FIELD_SKIP.has(k.toLowerCase())) continue;
      const s = readString(v).trim();
      if (s.length < VOD_SCRAPE_PLOT_MIN_LEN) continue;
      if (/^https?:\/\//i.test(s)) continue;
      if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) continue;
      if (s.length > best.length) best = s;
    }
  }
  return best;
};

const extractVodPlotFromBlocks = (
  info: Record<string, unknown>,
  movieData: Record<string, unknown>,
  vod: Record<string, unknown>,
  tmdb: Record<string, unknown>,
  root: Record<string, unknown>,
): string =>
  firstNonEmpty(
    readString(
      info.plot ??
        info.description ??
        info.overview ??
        info.synopsis ??
        info.storyline ??
        info.msg ??
        info.body ??
        info.about ??
        info.summary ??
        info.notes ??
        info.sinopse ??
        info.enredo ??
        info.text ??
        info.content ??
        info.full_plot ??
        info.plot_outline ??
        info.memo ??
        info.long_description ??
        info.longDescription ??
        info.desc ??
        info.comment ??
        info.biography ??
        info.details,
    ),
    readString(
      movieData.plot ??
        movieData.description ??
        movieData.overview ??
        movieData.sinopse ??
        movieData.enredo ??
        movieData.text ??
        movieData.content ??
        movieData.long_description ??
        movieData.longDescription ??
        movieData.desc ??
        movieData.comment,
    ),
    readString(
      vod.plot ?? vod.description ?? vod.overview ?? vod.long_description ?? vod.longDescription ?? vod.comment,
    ),
    readString(tmdb.overview ?? tmdb.plot ?? tmdb.description),
    readString(root.plot ?? root.description),
    scrapeLongestPlotLikeString(info, movieData, vod, tmdb),
  );

/** Chaves em que strings longas não são sinopse (URLs, elenco, credenciais, etc.). */
const VOD_DEEP_PLOT_SKIP_KEYS = new Set(
  [
    ...Array.from(VOD_PLOT_FIELD_SKIP),
    'password',
    'username',
    'token',
    'secret',
    'stream_url',
    'direct_source',
    'url',
    'backdrop',
    'trailer',
    'youtube_trailer',
    'user_info',
    'server_info',
    'dns',
    'port',
    'https_port',
    'server_protocol',
    'timezone',
  ].map((k) => k.toLowerCase()),
);

function collectVodPlotLikeStringsFromUnknown(
  value: unknown,
  key: string,
  depth: number,
  out: { text: string; score: number }[],
): void {
  if (depth > 12) return;
  const kl = key.toLowerCase();
  if (typeof value === 'string') {
    if (VOD_DEEP_PLOT_SKIP_KEYS.has(kl)) return;
    const t = value.trim();
    if (t.length < 15) return;
    if (/^https?:\/\//i.test(t)) return;
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) return;
    if (/^[A-Za-z0-9+/=\r\n]{120,}$/.test(t.replace(/\s/g, '')) && !/\.\s/.test(t)) return;
    let score = t.length;
    if (
      /plot|desc|synopsis|overview|sinopse|storyline|summary|about|body|content|informa|enredo|memo|nota|texto|biografia/i.test(
        key,
      )
    ) {
      score += 50_000;
    }
    out.push({ text: t, score });
    return;
  }
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectVodPlotLikeStringsFromUnknown(value[i], `${key}[${i}]`, depth + 1, out);
    }
    return;
  }
  if (kl === 'password' || kl === 'user_info' || kl === 'server_info') return;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    collectVodPlotLikeStringsFromUnknown(v, k, depth + 1, out);
  }
}

function deepExtractVodPlotFromRawJson(json: unknown): string {
  const scored: { text: string; score: number }[] = [];
  collectVodPlotLikeStringsFromUnknown(json, 'root', 0, scored);
  if (scored.length === 0) return '';
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.text ?? '';
}

function flattenVodInfoRootMovieWrapper(root: Record<string, unknown>): Record<string, unknown> {
  const m = root.movie;
  if (m == null || typeof m !== 'object' || Array.isArray(m)) return root;
  const mr = toRecord(m);
  if (Object.keys(mr).length === 0) return root;
  return {
    ...root,
    info: root.info ?? mr.info,
    movie_data: root.movie_data ?? mr.movie_data,
    vod: root.vod ?? mr.vod,
    plot: root.plot ?? mr.plot,
    description: root.description ?? mr.description,
  };
}

/**
 * Junta API híbrida (`primary`) com `get_vod_info` no cliente (`secondary`).
 * A API é a fonte principal por campo; o painel no browser só preenche lacunas.
 */
export function mergeXtreamVodInfoDetails(
  primary: XtreamVodInfoDetail | null,
  secondary: XtreamVodInfoDetail | null,
): XtreamVodInfoDetail | null {
  if (!primary) return secondary;
  if (!secondary) return primary;
  const pick = (api: string, panel: string) => firstNonEmpty(api, panel);
  const py = primary.year;
  const primaryYearOk = typeof py === 'number' && py >= 1900 && py <= 2100;
  const year = primaryYearOk ? py : secondary.year;
  return {
    plot: pick(primary.plot, secondary.plot),
    cast: pick(primary.cast, secondary.cast),
    director: pick(primary.director, secondary.director),
    genre: pick(primary.genre, secondary.genre),
    rating: pick(primary.rating, secondary.rating),
    releaseDate: pick(primary.releaseDate, secondary.releaseDate),
    durationLabel: pick(primary.durationLabel, secondary.durationLabel),
    movie_image: pick(primary.movie_image ?? '', secondary.movie_image ?? '') || undefined,
    year,
  };
}

const parseVodInfoResponse = (json: unknown): XtreamVodInfoDetail | null => {
  const root = flattenVodInfoRootMovieWrapper(toRecord(json));
  let info = normalizeMovieDataRecord(root.info);
  let movieData = normalizeMovieDataRecord(root.movie_data);
  const vod = normalizeMovieDataRecord(root.vod);
  if (!Object.keys(info).length && root.data != null) {
    const data = toRecord(root.data);
    info = normalizeMovieDataRecord(data.info ?? data);
    if (!Object.keys(movieData).length) {
      movieData = normalizeMovieDataRecord(data.movie_data);
    }
  }
  const tmdb = toRecord(
    info.tmdb_details ??
      info.tmdb ??
      movieData.tmdb_details ??
      movieData.tmdb ??
      root.tmdb_details ??
      root.tmdb,
  );
  const hasPayload =
    Object.keys(info).length > 0 ||
    Object.keys(movieData).length > 0 ||
    Object.keys(vod).length > 0 ||
    readString(root.plot).trim().length > 0 ||
    readString(root.description).trim().length > 0;
  if (!hasPayload) return null;

  const plot = extractVodPlotFromBlocks(info, movieData, vod, tmdb, root);
  const genre = firstNonEmpty(readString(info.genre ?? info.genres), readString(movieData.genre));
  const rating = firstNonEmpty(readString(info.rating ?? info.rating_5based), readString(movieData.rating));
  const cast = readString(info.cast);
  const director = readString(info.director);
  const releaseDate = readString(
    info.releaseDate ?? info.release_date ?? movieData.releaseDate ?? movieData.release_date,
  );
  const durationSecs = readOptionalNumber(info.duration_secs ?? info.duration ?? movieData.duration);
  const durationRaw = readString(info.duration ?? movieData.duration);
  const durationLabel =
    durationSecs != null && durationSecs > 0
      ? formatDurationSecs(durationSecs)
      : durationRaw || '';
  const movie_image = firstNonEmpty(
    readString(info.movie_image ?? info.cover ?? info.cover_big),
    readString(movieData.movie_image ?? movieData.cover),
  );
  const name = firstNonEmpty(readString(info.name), readString(movieData.name), readString(vod.name));
  let year =
    parseReleaseYear(releaseDate) ??
    extractYearFromTitle(name) ??
    extractYearFromTitle(readString(movieData.name));
  if (year == null) year = new Date().getFullYear();
  const plotFinal = plot.trim() ? plot : deepExtractVodPlotFromRawJson(json);
  return {
    plot: plotFinal,
    cast,
    director,
    genre,
    rating,
    releaseDate,
    durationLabel,
    movie_image: movie_image || undefined,
    year,
  };
};

/** Lista episódios da série (para play do 1º ou lista futura). */
export const fetchXtreamSeriesEpisodes = async (
  credentials: XtreamCredentials,
  seriesId: number
): Promise<XtreamSeriesEpisodeLink[]> => {
  const json = await fetchSeriesInfoJson(credentials, seriesId);
  return collectSeriesEpisodesFromInfo(json);
};

export const TEST_XTREAM_CREDENTIALS: XtreamCredentials = {
  name: 'Brasil',
  username: '2nsrgtjfuxy',
  password: 'a45mpju7vhy',
  serverUrl: 'http://assistirpainel.info:8880',
};

const assertXtreamCredentialsComplete = (credentials: XtreamCredentials): void => {
  const serverUrl = normalizeServerUrl(credentials.serverUrl, credentials.port).trim();
  if (!serverUrl || !credentials.username?.trim() || !credentials.password?.trim()) {
    throw new Error(
      'Xtream server URL, username and password are required. Movies and Series use the panel API—add an Xtream playlist, or an M3U URL that includes username and password (e.g. get.php?username=…&password=…). A plain M3U file link only supports Live TV from the playlist.'
    );
  }
};

const resolveApiUrl = (baseUrl: string): URL => {
  const trimmed = baseUrl.replace(/\/+$/, '').trim();
  if (!trimmed) {
    throw new Error('Xtream server URL is missing.');
  }
  const path = `${trimmed}/player_api.php`;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return new URL(path);
  }
  const origin =
    typeof globalThis !== 'undefined' && 'location' in globalThis && globalThis.location?.origin
      ? globalThis.location.origin
      : 'http://localhost';
  return new URL(path, origin);
};

const buildPlayerApiUrl = (baseUrl: string, credentials: XtreamCredentials, action?: string): URL => {
  assertXtreamCredentialsComplete(credentials);
  const url = resolveApiUrl(baseUrl);
  url.searchParams.set('username', credentials.username.trim());
  url.searchParams.set('password', credentials.password);
  if (action) url.searchParams.set('action', action);
  return url;
};

/**
 * Keep headers browser-safe for TV WebViews.
 * Some runtimes reject forbidden headers (like User-Agent) with a network TypeError.
 */
const XTREAM_API_HEADERS: HeadersInit = {
  Accept: 'application/json',
};

/** Wrap absolute URLs for dev-only Node proxy (Vite middleware). Not used in production/Tizen. */
const wrapProxyUrl = (absoluteUrl: string): string =>
  `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;

const isPlayerApiUrl = (url: string): boolean => url.includes('player_api.php');

/**
 * Em dev, `player_api.php` via `/api/proxy` (middleware Node) — evita respostas vazias/truncadas
 * com listas VOD/Series muito grandes no proxy HTTP `/xtream` do Vite.
 * Se o fetch a `/api/proxy` falhar em rede (ex.: undici/IPv6), tenta `/xtream` só quando o host
 * coincide com `XTREAM_VITE_DEV_PROXY_TARGET` em `vite.config.ts`.
 */
const devPlayerApiFetchViaViteXtreamPath = (absoluteUrl: string): Promise<Response> => {
  const u = new URL(absoluteUrl);
  return fetch(`/xtream${u.pathname}${u.search}`, {
    method: 'GET',
    headers: XTREAM_API_HEADERS,
  });
};

const xhrGet = (url: string, headers?: HeadersInit): Promise<Response> =>
  new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 30000;
      if (headers && typeof headers === 'object') {
        const h = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
        for (const [k, v] of Object.entries(h)) {
          if (v == null) continue;
          try {
            xhr.setRequestHeader(k, String(v));
          } catch {
            /* forbidden header in this runtime */
          }
        }
      }
      xhr.onreadystatechange = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) return;
        const status = xhr.status || 0;
        if (status <= 0) {
          reject(new TypeError('XHR network error'));
          return;
        }
        resolve(
          new Response(xhr.responseText, {
            status,
            statusText: xhr.statusText || 'OK',
          })
        );
      };
      xhr.onerror = () => reject(new TypeError('XHR request failed'));
      xhr.ontimeout = () => reject(new TypeError('XHR timeout'));
      xhr.send();
    } catch (e) {
      reject(e);
    }
  });

const safeGetFetch = async (url: string, headers?: HeadersInit): Promise<Response> => {
  try {
    return await fetch(url, headers ? { method: 'GET', headers } : { method: 'GET' });
  } catch (firstErr) {
    // TV browsers can fail when a header is unsupported/restricted; retry once with no headers.
    if (headers) {
      try {
        return await fetch(url, { method: 'GET' });
      } catch {
        if (typeof XMLHttpRequest !== 'undefined') {
          return xhrGet(url);
        }
        throw firstErr;
      }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      return xhrGet(url);
    }
    throw firstErr;
  }
};

const xtreamFetch = async (url: string): Promise<Response> => {
  const isHttp = url.startsWith('http://') || url.startsWith('https://');
  const isDevBrowser = typeof window !== 'undefined' && import.meta.env.DEV;

  /**
   * Em DEV no browser, tentar primeiro `/api/proxy` (middleware Vite = mesmo host que a app),
   * porque muitos painéis bloqueiam o IP da Lambda na AWS (403).
   */
  if (isDevBrowser && isHttp && isPlayerApiUrl(url)) {
    try {
      const r = await safeGetFetch(wrapProxyUrl(url), XTREAM_API_HEADERS);
      if (r.ok) return r;
    } catch {
      /* tentar /xtream ou proxy remoto */
    }
    if (xtreamUrlMatchesViteDevProxyTarget(url)) {
      try {
        const r2 = await devPlayerApiFetchViaViteXtreamPath(url);
        if (r2.ok) return r2;
      } catch {
        /* proxy remoto */
      }
    }
    // Fallback DEV: usar /__iptv_dev/fetch (middleware Vite inline que faz fetch no Node)
    // quando /api/proxy não está disponível (servidor local 8787 não está rodando).
    try {
      const devR = await fetch(`/__iptv_dev/fetch?url=${encodeURIComponent(url)}`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (devR.ok) return devR;
    } catch {
      /* cair para proxy Lambda */
    }
  }

  /**
   * Tizen WebView: fetch direto ao painel Xtream antes de tentar o proxy Lambda.
   * Muitos painéis IPTV usam Cloudflare que bloqueia IPs de datacenter (AWS).
   * A TV Samsung está em rede residencial, então o fetch direto passa sem 403.
   * O WebView Tizen (file:// ou app://) não aplica CORS estritamente.
   */
  if (isSamsungTizenLikeRuntime() && isHttp) {
    try {
      const r = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (r.ok) return r;
      console.warn('[xtreamFetch] Tizen direct failed:', r.status, url.slice(0, 120));
    } catch (e) {
      console.warn('[xtreamFetch] Tizen direct error:', e, url.slice(0, 120));
      /* cair para proxy Lambda */
    }
  }

  const backendProxy = buildBackendProxyUrl('/proxy', url);
  return proxyClientGet(backendProxy);
};

/** Lê JSON; corpo vazio evita `Unexpected end of JSON input` nos browsers. */
const readXtreamJsonResponse = async (res: Response, context: string): Promise<unknown> => {
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error(`${context}: empty response (HTTP ${res.status}).`);
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const preview = trimmed.slice(0, 160).replace(/\s+/g, ' ');
    throw new Error(`${context}: invalid JSON (HTTP ${res.status}). Preview: ${preview}`);
  }
};

const fetchSeriesInfoJson = async (
  credentials: XtreamCredentials,
  seriesId: number
): Promise<unknown> => {
  const baseUrl = getXtreamBaseUrl(credentials);
  const url = buildPlayerApiUrl(baseUrl, credentials, 'get_series_info');
  url.searchParams.set('series_id', String(seriesId));
  const res = await xtreamFetch(url.toString());
  if (!res.ok) throw new Error(`Series info failed (${res.status}).`);
  return readXtreamJsonResponse(res, 'Series info');
};

export const fetchXtreamSeriesInfo = async (
  credentials: XtreamCredentials,
  seriesId: number
): Promise<XtreamSeriesInfoResult> => {
  const json = await fetchSeriesInfoJson(credentials, seriesId);
  return parseXtreamSeriesInfoResult(json);
};

export const fetchXtreamVodInfo = async (
  credentials: XtreamCredentials,
  vodId: number
): Promise<XtreamVodInfoDetail | null> => {
  const baseUrl = getXtreamBaseUrl(credentials);
  const url = buildPlayerApiUrl(baseUrl, credentials, 'get_vod_info');
  url.searchParams.set('vod_id', String(vodId));
  const res = await xtreamFetch(url.toString());
  if (!res.ok) return null;
  const json = await readXtreamJsonResponse(res, 'VOD info');
  return parseVodInfoResponse(json);
};

const parseJsonArray = (raw: unknown): unknown[] => (Array.isArray(raw) ? raw : []);

const parseLiveCategory = (row: unknown): XtreamLiveCategory | null => {
  const r = toRecord(row);
  const id = readString(r.category_id);
  const name = readString(r.category_name);
  if (!id || !name) return null;
  return { category_id: id, category_name: name };
};

const parseLiveStream = (row: unknown): XtreamLiveStream | null => {
  const r = toRecord(row);
  const streamId = Number(r.stream_id);
  const name = readString(r.name);
  if (!Number.isFinite(streamId) || !name) return null;
  const categoryId = r.category_id == null ? null : readString(r.category_id);
  const fromApi = firstNonEmpty(
    readString(r.direct_source),
    readString(r.stream_url),
    readString(r.url)
  );
  const playbackUrlFromApi =
    fromApi && /^https?:\/\//i.test(fromApi.trim()) ? fromApi.trim() : undefined;
  return {
    num: typeof r.num === 'number' ? r.num : undefined,
    name,
    stream_type: r.stream_type == null ? undefined : readString(r.stream_type),
    stream_id: streamId,
    stream_icon: r.stream_icon == null ? undefined : readString(r.stream_icon),
    epg_channel_id: r.epg_channel_id == null ? undefined : readString(r.epg_channel_id),
    category_id: categoryId ?? null,
    tv_archive: typeof r.tv_archive === 'number' ? r.tv_archive : undefined,
    container_extension:
      r.container_extension == null ? undefined : readString(r.container_extension),
    playbackUrlFromApi,
  };
};

const parseVodCategory = (row: unknown): XtreamVodCategory | null => {
  const r = toRecord(row);
  const id = readString(r.category_id);
  const name = readString(r.category_name);
  if (!id || !name) return null;
  return { category_id: id, category_name: name };
};

const parseVodStream = (row: unknown): XtreamVodStream | null => {
  const r = toRecord(row);
  const streamId = Number(r.stream_id);
  const name = readString(r.name);
  if (!Number.isFinite(streamId) || !name) return null;
  const categoryId = r.category_id == null ? null : readString(r.category_id);
  return {
    stream_id: streamId,
    name,
    stream_icon: r.stream_icon == null ? undefined : readString(r.stream_icon),
    category_id: categoryId ?? null,
    added: r.added == null ? undefined : readString(r.added),
    rating: r.rating == null ? undefined : readString(r.rating),
    container_extension: r.container_extension == null ? undefined : readString(r.container_extension),
    plot: r.plot == null ? undefined : readString(r.plot),
    description: r.description == null ? undefined : readString(r.description),
    synopsis: r.synopsis == null ? undefined : readString(r.synopsis),
    genre: r.genre == null ? undefined : readString(r.genre),
    director: r.director == null ? undefined : readString(r.director),
    cast: r.cast == null ? undefined : readString(r.cast),
    releaseDate: r.releaseDate == null ? undefined : readString(r.releaseDate),
    release_date: r.release_date == null ? undefined : readString(r.release_date),
    year: r.year == null ? undefined : r.year as string | number,
    duration: r.duration == null ? undefined : readString(r.duration),
    duration_secs: r.duration_secs == null ? undefined : r.duration_secs as string | number,
  };
};

const parseSeriesCategory = (row: unknown): XtreamSeriesCategory | null => {
  const r = toRecord(row);
  const id = readString(r.category_id);
  const name = readString(r.category_name);
  if (!id || !name) return null;
  return { category_id: id, category_name: name };
};

const parseSeriesStream = (row: unknown): XtreamSeriesStream | null => {
  const r = toRecord(row);
  const seriesId = Number(r.series_id ?? r.stream_id);
  const name = readString(r.name);
  if (!Number.isFinite(seriesId) || !name) return null;
  const categoryId = r.category_id == null ? null : readString(r.category_id);
  const coverArt = firstNonEmpty(
    readString(r.cover_big),
    readString(r.cover),
    readString(r.stream_icon),
    readString(r.icon),
    readString(r.thumbnail),
    readString(r.backdrop_path)
  );
  return {
    series_id: seriesId,
    name,
    cover: coverArt || undefined,
    category_id: categoryId ?? null,
    last_modified: r.last_modified == null ? undefined : readString(r.last_modified),
    rating: r.rating == null ? undefined : readString(r.rating),
    plot: r.plot == null ? undefined : readString(r.plot),
    description: r.description == null ? undefined : readString(r.description),
    synopsis: r.synopsis == null ? undefined : readString(r.synopsis),
    genre: r.genre == null ? undefined : readString(r.genre),
    cast: r.cast == null ? undefined : readString(r.cast),
    releaseDate: r.releaseDate == null ? undefined : readString(r.releaseDate),
    release_date: r.release_date == null ? undefined : readString(r.release_date),
    year: r.year == null ? undefined : r.year as string | number,
  };
};

export const guessQualityLabel = (name: string): Channel['quality'] => {
  const u = name.toUpperCase();
  if (u.includes('4K') || u.includes('UHD')) return '4K';
  if (u.includes('FHD') || u.includes('1080')) return 'FHD';
  if (u.includes('HD') || u.includes('720')) return 'HD';
  return 'SD';
};

export const buildCategoryNameMap = (categories: XtreamLiveCategory[]): Map<string, string> => {
  const map = new Map<string, string>();
  for (const c of categories) {
    map.set(String(c.category_id), normalizeCategoryDisplayName(c.category_name));
  }
  return map;
};

export const mapXtreamLiveToChannel = (
  stream: XtreamLiveStream,
  index: number,
  categoryNameById: Map<string, string>
): Channel => {
  const cid = stream.category_id == null ? '' : String(stream.category_id);
  return {
    id: stream.stream_id,
    number: index + 1,
    name: stream.name,
    quality: guessQualityLabel(stream.name),
    isLive: true,
    isFavorite: false,
    logo: stream.stream_icon?.trim() ? stream.stream_icon : undefined,
    category: cid ? categoryNameById.get(cid) ?? 'Live' : 'Live',
  };
};

export const mapStreamsToChannels = (
  streams: XtreamLiveStream[],
  categories: XtreamLiveCategory[]
): Channel[] => {
  const nameById = buildCategoryNameMap(categories);
  return streams.map((s, i) => mapXtreamLiveToChannel(s, i, nameById));
};

const explainLiveNetworkFailure = (label: string, lastErr: unknown): Error => {
  const base = getBackendApiBase();
  if (lastErr instanceof TypeError) {
    return new Error(
      `Cannot reach backend proxy at ${base} while loading ${label}. Check network, firewall, and that the proxy serves /proxy with CORS.`
    );
  }
  return lastErr instanceof Error ? lastErr : new Error(`${label} failed.`);
};

export const fetchXtreamLiveCategories = async (credentials: XtreamCredentials): Promise<XtreamLiveCategory[]> => {
  const bases = getXtreamBaseUrlCandidates(credentials);
  let lastErr: unknown = null;
  for (const baseUrl of bases) {
    try {
      const url = buildPlayerApiUrl(baseUrl, credentials, 'get_live_categories');
      const res = await xtreamFetch(url.toString());
      if (!res.ok) throw new Error(`Live categories failed (${res.status}).`);
      const json = await readXtreamJsonResponse(res, 'Live categories');
      return parseJsonArray(json).map(parseLiveCategory).filter((x): x is XtreamLiveCategory => Boolean(x));
    } catch (e) {
      lastErr = e;
    }
  }
  throw explainLiveNetworkFailure('Live categories', lastErr);
};

export const fetchXtreamLiveStreams = async (credentials: XtreamCredentials): Promise<XtreamLiveStream[]> => {
  const bases = getXtreamBaseUrlCandidates(credentials);
  let lastErr: unknown = null;
  for (const baseUrl of bases) {
    try {
      const url = buildPlayerApiUrl(baseUrl, credentials, 'get_live_streams');
      const res = await xtreamFetch(url.toString());
      if (!res.ok) throw new Error(`Live streams failed (${res.status}).`);
      const json = await readXtreamJsonResponse(res, 'Live streams');
      return parseJsonArray(json).map(parseLiveStream).filter((x): x is XtreamLiveStream => Boolean(x));
    } catch (e) {
      lastErr = e;
    }
  }
  throw explainLiveNetworkFailure('Live streams', lastErr);
};

/** Entrada normalizada de `get_short_epg` (timestamps em segundos Unix). */
export interface XtreamShortEpgEntry {
  title: string;
  description: string;
  startSec: number;
  endSec: number;
}

/** Horário estilo XMLTV `YYYYMMDDHHmmss` (+ offset opcional). */
const parseXmltvUtcSeconds = (value: unknown): number | null => {
  const s = readString(value).trim();
  if (!/^\d{14}/.test(s)) return null;
  const Y = Number(s.slice(0, 4));
  const M = Number(s.slice(4, 6)) - 1;
  const D = Number(s.slice(6, 8));
  const h = Number(s.slice(8, 10));
  const m = Number(s.slice(10, 12));
  const sec = Number(s.slice(12, 14));
  if (![Y, M + 1, D, h, m, sec].every(Number.isFinite)) return null;
  return Math.floor(Date.UTC(Y, M, D, h, m, sec) / 1000);
};

const readUnixSeconds = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const iso = Date.parse(value);
    if (!Number.isNaN(iso)) return Math.floor(iso / 1000);
    const xml = parseXmltvUtcSeconds(value);
    if (xml != null) return xml;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }
  return null;
};

const extractShortEpgRows = (json: unknown): unknown[] => {
  if (Array.isArray(json)) return json;
  const r = toRecord(json);
  if (Array.isArray(r.epg_listings)) return r.epg_listings;
  if (r.data != null) {
    const d = toRecord(r.data);
    if (Array.isArray(d.epg_listings)) return d.epg_listings;
    if (Array.isArray(d.epg)) return d.epg;
  }
  if (Array.isArray(r.listings)) return r.listings;
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (Array.isArray(v) && v.length > 0) return v;
  }
  return [];
};

/**
 * Muitos painéis Xtream enviam título/descrição do EPG em Base64 (bytes UTF-8).
 * Se não for Base64 válido ou o resultado for lixo, devolve o texto original.
 */
const decodeXtreamEpgText = (raw: string): string => {
  const s = raw.trim();
  if (s.length < 8) return raw;
  if (s.length % 4 !== 0) return raw;
  if (!/^[A-Za-z0-9+/]+=*$/.test(s)) return raw;
  try {
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const out = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const t = out.trim();
    if (t.length === 0) return raw;
    let ok = 0;
    for (let i = 0; i < t.length; i++) {
      const c = t.charCodeAt(i);
      if (c === 9 || c === 10 || c === 13) ok++;
      else if (c >= 32 && c !== 127) ok++;
    }
    if (ok / t.length < 0.65) return raw;
    return t;
  } catch {
    return raw;
  }
};

const parseShortEpgRow = (row: unknown): XtreamShortEpgEntry | null => {
  const r = toRecord(row);
  const titleRaw = readString(
    r.title ?? r.name ?? r.program_name ?? r.program ?? r.program_title ?? r.programme
  );
  const startSec = readUnixSeconds(
    r.start ?? r.start_timestamp ?? r.startTime ?? r.start_sec ?? r.start_time ?? r.begin
  );
  const endSec = readUnixSeconds(
    r.end ?? r.stop ?? r.end_timestamp ?? r.endTime ?? r.end_sec ?? r.end_time ?? r.finish
  );
  let s = startSec;
  let e = endSec;
  if (s == null || e == null || e <= s) {
    const xs = parseXmltvUtcSeconds(r.start);
    const xe = parseXmltvUtcSeconds(r.end ?? r.stop);
    if (xs != null && xe != null && xe > xs) {
      s = xs;
      e = xe;
    }
  }
  if (s == null || e == null || e <= s) return null;
  const titleBase = titleRaw.trim() || 'Program';
  const title = decodeXtreamEpgText(titleBase) || titleBase;
  const descRaw = readString(r.description ?? r.desc ?? r.plot ?? r.summary ?? '');
  const description = decodeXtreamEpgText(descRaw.trim()) || descRaw;
  return {
    title: title || 'Program',
    description,
    startSec: s,
    endSec: e,
  };
};

const fetchShortEpgSingle = async (
  credentials: XtreamCredentials,
  streamIdParamValue: string,
  limit: number
): Promise<XtreamShortEpgEntry[]> => {
  const job = async (): Promise<XtreamShortEpgEntry[]> => {
    const baseUrl = getXtreamBaseUrl(credentials);
    const url = buildPlayerApiUrl(baseUrl, credentials, 'get_short_epg');
    url.searchParams.set('stream_id', streamIdParamValue);
    url.searchParams.set('limit', String(limit));
    const res = await xtreamFetch(url.toString());
    if (!res.ok) return [];
    const text = await res.text();
    const trimmed = text.trim();
    if (trimmed === '') return [];
    let json: unknown;
    try {
      json = JSON.parse(trimmed) as unknown;
    } catch {
      return [];
    }
    return extractShortEpgRows(json).map(parseShortEpgRow).filter((x): x is XtreamShortEpgEntry => Boolean(x));
  };

  const timeoutMs = 4500;
  return Promise.race([
    job(),
    new Promise<XtreamShortEpgEntry[]>(resolve => {
      window.setTimeout(() => resolve([]), timeoutMs);
    }),
  ]);
};

/**
 * EPG curto por canal (`action=get_short_epg`).
 * Muitos painéis indexam o guia por `epg_channel_id` (lista ao vivo), não pelo `stream_id` numérico —
 * passa esse valor como `stream_id` na query quando existir.
 */
export const fetchXtreamShortEpg = async (
  credentials: XtreamCredentials,
  streamId?: number | null,
  limit: number = 12,
  epgChannelId?: string | null
): Promise<XtreamShortEpgEntry[]> => {
  const attempts: string[] = [];
  const epg = epgChannelId?.trim();
  if (epg) {
    attempts.push(epg);
    attempts.push(epg.replace(/&/g, '%26'));
    attempts.push(epg.replace(/[^a-zA-Z0-9:_-]/g, ''));
  }
  if (typeof streamId === 'number' && Number.isFinite(streamId)) {
    attempts.push(String(streamId));
  }
  if (attempts.length === 0) return [];
  const seen = new Set<string>();
  for (const id of attempts) {
    if (seen.has(id)) continue;
    seen.add(id);
    const rows = await fetchShortEpgSingle(credentials, id, limit);
    if (rows.length > 0) return rows;
  }
  return [];
};

export interface XtreamEpgNowNext {
  current: XtreamShortEpgEntry | null;
  next: XtreamShortEpgEntry | null;
}

export const pickCurrentAndNextEpg = (
  entries: XtreamShortEpgEntry[],
  nowSec: number = Math.floor(Date.now() / 1000)
): XtreamEpgNowNext => {
  if (entries.length === 0) return { current: null, next: null };
  const sorted = [...entries].sort((a, b) => a.startSec - b.startSec);
  const current = sorted.find(e => nowSec >= e.startSec && nowSec < e.endSec) ?? null;
  if (current) {
    /** Próximo slot distinto (evita duplicata do provider com o mesmo horário/título). */
    const next =
      sorted.find(
        e =>
          e.startSec >= current.endSec &&
          (e.startSec !== current.startSec || e.endSec !== current.endSec)
      ) ?? null;
    return { current, next };
  }
  const next = sorted.find(e => e.startSec > nowSec) ?? null;
  return { current: null, next };
};

export const epgProgressPercent = (entry: XtreamShortEpgEntry, nowSec: number = Math.floor(Date.now() / 1000)): number => {
  const span = entry.endSec - entry.startSec;
  if (span <= 0) return 0;
  const t = (nowSec - entry.startSec) / span;
  return Math.round(Math.min(1, Math.max(0, t)) * 100);
};

export const formatEpgClock = (unixSec: number): string =>
  new Date(unixSec * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const formatEpgRange = (startSec: number, endSec: number): string =>
  `${formatEpgClock(startSec)} - ${formatEpgClock(endSec)}`;

export const fetchXtreamVodCategories = async (credentials: XtreamCredentials): Promise<XtreamVodCategory[]> => {
  const baseUrl = getXtreamBaseUrl(credentials);
  const url = buildPlayerApiUrl(baseUrl, credentials, 'get_vod_categories');
  const res = await xtreamFetch(url.toString());
  if (!res.ok) throw new Error(`VOD categories failed (${res.status}).`);
  const json = await readXtreamJsonResponse(res, 'VOD categories');
  return parseJsonArray(json).map(parseVodCategory).filter((x): x is XtreamVodCategory => Boolean(x));
};

export const fetchXtreamVodStreams = async (credentials: XtreamCredentials): Promise<XtreamVodStream[]> => {
  const baseUrl = getXtreamBaseUrl(credentials);
  const url = buildPlayerApiUrl(baseUrl, credentials, 'get_vod_streams');
  const res = await xtreamFetch(url.toString());
  if (!res.ok) throw new Error(`VOD streams failed (${res.status}).`);
  const json = await readXtreamJsonResponse(res, 'VOD streams');
  return parseJsonArray(json).map(parseVodStream).filter((x): x is XtreamVodStream => Boolean(x));
};

export const fetchXtreamSeriesCategories = async (credentials: XtreamCredentials): Promise<XtreamSeriesCategory[]> => {
  const baseUrl = getXtreamBaseUrl(credentials);
  const url = buildPlayerApiUrl(baseUrl, credentials, 'get_series_categories');
  const res = await xtreamFetch(url.toString());
  if (!res.ok) throw new Error(`Series categories failed (${res.status}).`);
  const json = await readXtreamJsonResponse(res, 'Series categories');
  return parseJsonArray(json).map(parseSeriesCategory).filter((x): x is XtreamSeriesCategory => Boolean(x));
};

export const fetchXtreamSeries = async (credentials: XtreamCredentials): Promise<XtreamSeriesStream[]> => {
  const baseUrl = getXtreamBaseUrl(credentials);
  const url = buildPlayerApiUrl(baseUrl, credentials, 'get_series');
  const res = await xtreamFetch(url.toString());
  if (!res.ok) throw new Error(`Series list failed (${res.status}).`);
  const json = await readXtreamJsonResponse(res, 'Series list');
  return parseJsonArray(json).map(parseSeriesStream).filter((x): x is XtreamSeriesStream => Boolean(x));
};

export type XtreamAccountSnapshot = {
  authenticated: boolean;
  status: string;
  /** Valor bruto do painel (`exp_date`, muitas vezes Unix em segundos). */
  expDateRaw?: string;
  username?: string;
  activeCons?: string;
  maxConnections?: string;
  isTrial?: string;
  createdAtRaw?: string;
  message?: string;
  serverTimezone?: string;
  serverProtocol?: string;
  serverPort?: string;
};

/**
 * Lê só `player_api.php` (auth) — `user_info` e `server_info` do painel, sem listar streams.
 */
export async function fetchXtreamAccountSnapshot(
  credentials: XtreamCredentials
): Promise<XtreamAccountSnapshot | null> {
  try {
    const bases = getXtreamBaseUrlCandidates(credentials);
    let authJson: unknown = null;
    let found = false;
    for (const baseUrl of bases) {
      try {
        const authUrl = buildPlayerApiUrl(baseUrl, credentials);
        const authResponse = await xtreamFetch(authUrl.toString());
        if (!authResponse.ok) continue;
        authJson = await readXtreamJsonResponse(authResponse, 'Account snapshot');
        found = true;
        break;
      } catch {
        /* try next candidate */
      }
    }
    if (!found) return null;
    const authRoot = toRecord(authJson);
    const userInfo = toRecord(authRoot.user_info);
    const serverInfo = toRecord(authRoot.server_info);
    const auth = Number(userInfo.auth) === 1;
    const status = readString(userInfo.status) || 'Unknown';
    const expDateRaw = readString(userInfo.exp_date);
    const username = readString(userInfo.username) || credentials.username;
    const message = readString(userInfo.message);
    const serverTimezone = readString(serverInfo.timezone);
    const serverProtocol = readString(serverInfo.server_protocol ?? serverInfo.protocol);
    const serverPort = readString(serverInfo.port);

    if (!auth) {
      return {
        authenticated: false,
        status,
        username,
        message: message || undefined,
      };
    }

    return {
      authenticated: true,
      status,
      expDateRaw,
      username,
      activeCons: readString(userInfo.active_cons),
      maxConnections: readString(userInfo.max_connections),
      isTrial: readString(userInfo.is_trial),
      createdAtRaw: readString(userInfo.created_at),
      message: message || undefined,
      serverTimezone: serverTimezone || undefined,
      serverProtocol: serverProtocol || undefined,
      serverPort: serverPort || undefined,
    };
  } catch {
    return null;
  }
}

/** Formata `exp_date` do Xtream (Unix segundos ou string) para exibição local. */
export function formatXtreamExpDateDisplay(expDateRaw: string | undefined): string {
  if (!expDateRaw?.trim()) return '—';
  const s = expDateRaw.trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) {
      const ms = s.length >= 13 ? n : n * 1000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
      }
    }
  }
  return s;
}

export const connectXtream = async (credentials: XtreamCredentials): Promise<XtreamConnectionResult> => {
  const baseUrl = getXtreamBaseUrl(credentials);
  const authUrl = buildPlayerApiUrl(baseUrl, credentials);
  const authResponse = await xtreamFetch(authUrl.toString());

  if (!authResponse.ok) {
    throw new Error(`Connection failed (${authResponse.status}).`);
  }

  const authJson = await readXtreamJsonResponse(authResponse, 'Xtream auth');
  const authRoot = toRecord(authJson);
  const userInfo = toRecord(authRoot.user_info);
  const auth = Number(userInfo.auth) === 1;

  if (!auth) {
    throw new Error('Xtream authentication rejected your credentials.');
  }

  const status = readString(userInfo.status) || 'Unknown';
  const expDate = readString(userInfo.exp_date);
  const activeCons = readString(userInfo.active_cons);
  const maxConnections = readString(userInfo.max_connections);

  const liveUrl = buildPlayerApiUrl(baseUrl, credentials, 'get_live_streams');
  const liveResponse = await xtreamFetch(liveUrl.toString());

  if (!liveResponse.ok) {
    throw new Error(`Connected, but streams fetch failed (${liveResponse.status}).`);
  }

  const liveJson = await readXtreamJsonResponse(liveResponse, 'Live streams (connect)');
  const liveStreamsCount = Array.isArray(liveJson) ? liveJson.length : 0;

  return {
    isAuthorized: auth,
    status,
    expDate,
    activeCons,
    maxConnections,
    liveStreamsCount,
  };
};

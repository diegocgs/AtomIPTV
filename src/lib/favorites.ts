import type { Channel } from '@/components/iptv/ChannelList';

export const FAVORITES_STORAGE_KEY = 'favorites';

/** Single playlist source until multi-playlist is supported */
export const DEFAULT_PLAYLIST_ID = 'default';

/** Favoritos VOD (filmes) — evita colidir com IDs de canais ao vivo. */
export const FAVORITE_PLAYLIST_VOD = 'vod';

/** Favoritos de séries. */
export const FAVORITE_PLAYLIST_SERIES = 'series';

export interface FavoriteLiveChannel {
  /** `${playlist_id}:${channel_id}` */
  id: string;
  channel_id: string;
  playlist_id: string;
  name: string;
  logo: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isValidFavorite = (v: unknown): v is FavoriteLiveChannel => {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.channel_id === 'string' &&
    typeof v.playlist_id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.logo === 'string'
  );
};

export const buildFavoriteId = (playlistId: string, channelId: number): string =>
  `${playlistId}:${String(channelId)}`;

export const getFavorites = (): FavoriteLiveChannel[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const list = parsed.filter(isValidFavorite);
    const seen = new Set<string>();
    return list.filter(f => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
  } catch {
    return [];
  }
};

export const saveFavorites = (items: FavoriteLiveChannel[]): void => {
  if (typeof window === 'undefined') return;
  const seen = new Set<string>();
  const deduped = items.filter(f => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(deduped));
};

export const isFavoriteChannelId = (channelId: number, playlistId: string = DEFAULT_PLAYLIST_ID): boolean => {
  const id = buildFavoriteId(playlistId, channelId);
  return getFavorites().some(f => f.id === id);
};

export const addFavorite = (channel: Channel, playlistId: string = DEFAULT_PLAYLIST_ID): void => {
  const channel_id = String(channel.id);
  const id = buildFavoriteId(playlistId, channel.id);
  const current = getFavorites();
  if (current.some(f => f.id === id)) return;
  saveFavorites([
    ...current,
    {
      id,
      channel_id,
      playlist_id: playlistId,
      name: channel.name,
      logo: channel.logo ?? '',
    },
  ]);
};

export const removeFavorite = (channelId: number, playlistId: string = DEFAULT_PLAYLIST_ID): void => {
  const id = buildFavoriteId(playlistId, channelId);
  saveFavorites(getFavorites().filter(f => f.id !== id));
};

export const toggleFavorite = (channel: Channel, playlistId: string = DEFAULT_PLAYLIST_ID): boolean => {
  const id = buildFavoriteId(playlistId, channel.id);
  const current = getFavorites();
  const exists = current.some(f => f.id === id);
  if (exists) {
    saveFavorites(current.filter(f => f.id !== id));
    return false;
  }
  saveFavorites([
    ...current,
    {
      id,
      channel_id: String(channel.id),
      playlist_id: playlistId,
      name: channel.name,
      logo: channel.logo ?? '',
    },
  ]);
  return true;
};

export const favoriteChannelIdSet = (playlistId: string = DEFAULT_PLAYLIST_ID): Set<string> => {
  const set = new Set<string>();
  for (const f of getFavorites()) {
    if (f.playlist_id === playlistId) set.add(f.channel_id);
  }
  return set;
};

/** ID do item em `getFavorites()` para canal Live TV (IDs string: M3U, Xtream, etc.). */
export function buildLiveFavoriteEntryId(playlistId: string, channelId: string): string {
  return `${playlistId}:${channelId}`;
}

/**
 * Liga/desliga favorito de canal ao vivo; persiste em `localStorage` com os restantes favoritos.
 */
export function toggleLiveChannelFavorite(params: {
  playlistId: string;
  channelId: string;
  name: string;
  logo: string;
}): boolean {
  const compositeId = buildLiveFavoriteEntryId(params.playlistId, params.channelId);
  const current = getFavorites();
  const exists = current.some((f) => f.id === compositeId);
  if (exists) {
    saveFavorites(current.filter((f) => f.id !== compositeId));
    return false;
  }
  saveFavorites([
    ...current,
    {
      id: compositeId,
      channel_id: params.channelId,
      playlist_id: params.playlistId,
      name: params.name,
      logo: params.logo,
    },
  ]);
  return true;
}

/** Converte filme/série VOD para o formato `Channel` usado em `toggleFavorite`. */
export const vodItemToChannel = (p: {
  id: number;
  title: string;
  genre: string;
  iconUrl?: string;
}): Channel => ({
  id: p.id,
  name: p.title,
  number: 0,
  quality: 'HD',
  isLive: false,
  isFavorite: false,
  category: p.genre,
  logo: p.iconUrl,
});

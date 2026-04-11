import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVodGridColumns } from '@/hooks/useVodGridColumns'
import { useVodGridScrollIntoView } from '@/hooks/useVodGridScrollIntoView'
import { useNavigate } from 'react-router-dom'
import { Film, Star, Tv, Loader2 } from 'lucide-react'
import IptvRemoteImage from '@/components/iptv/IptvRemoteImage'
import { IptvSearchField } from '@/components/iptv/IptvSearchField'
import VodDetailModal from '@/components/iptv/VodDetailModal'
import { useMoviesCatalog } from '@/features/catalog'
import { useVisibleGridSlice } from '@/hooks/useVisibleGridSlice'
import { usePosterWarmup } from '@/hooks/usePosterWarmup'
import {
  FocusPlan,
  TVFocusable,
  buildVodCatalogShellPlan,
  isSamsungTizenLikeRuntime,
} from '@/lib/tvFocus'
import { tvFocusIdStore } from '@/lib/tvFocus/tvFocusIdStore'
import { useVodCatalogNavigation } from '@/pages/vod/useVodCatalogNavigation'
import { enrichXtreamMovieDetail, prefetchXtreamMovieDetails } from '@/lib/vodDetailEnrichment'
import { resolveMoviePlayUrl } from '@/lib/vodPlaybackResolve'
import { cn, moveCaretToEndOnFocus } from '@/lib/utils'
import {
  resolveXtreamVodDurationLabel,
  resolveXtreamVodGenre,
  resolveXtreamVodPlot,
  resolveXtreamVodYear,
  type XtreamVodInfoDetail,
  type XtreamVodStream,
} from '@/services/xtream'
import { FAVORITE_PLAYLIST_VOD, getFavorites, toggleFavorite, vodItemToChannel } from '@/lib/favorites'
import { usePlaylists } from '@/features/playlists/hooks/usePlaylists'
import { playlistServiceGetActivePlaylist } from '@/features/playlists/services/playlistService'

type CategoryRow = {
  id: string
  name: string
  count: number
}

type MovieUi = {
  id: number
  title: string
  titleLower: string
  year: number
  rating: string
  iconUrl?: string
  color: string
}

const GRADIENTS = [
  'from-cyan-900/60 to-blue-950/80',
  'from-red-900/60 to-gray-950/80',
  'from-emerald-900/60 to-teal-950/80',
  'from-purple-900/60 to-indigo-950/80',
  'from-sky-900/60 to-slate-950/80',
  'from-amber-900/60 to-yellow-950/80',
]

export default function MoviesPage() {
  const navigate = useNavigate()
  const { activePlaylistId } = usePlaylists()
  const [selectedCategory, setSelectedCategory] = useState(0)
  const [categorySearch, setCategorySearch] = useState('')
  const [movieSearch, setMovieSearch] = useState('')
  const [detail, setDetail] = useState<XtreamVodStream | null>(null)
  const [vodApiDetail, setVodApiDetail] = useState<XtreamVodInfoDetail | null>(null)
  const [vodDetailLoading, setVodDetailLoading] = useState(false)
  const modalFocusTimerRef = useRef<number | null>(null)

  // Limpar timeout de restauração de foco ao desmontar — evita que um setTimeout
  // stale corrompa o tvFocusIdStore depois de navegar para outra página.
  useEffect(() => {
    return () => {
      if (modalFocusTimerRef.current != null) {
        clearTimeout(modalFocusTimerRef.current)
        modalFocusTimerRef.current = null
      }
    }
  }, [])

  // playlist_id exclusivo para favoritos VOD — prefixo 'vod:' evita colisão com
  // canais ao vivo que usam o mesmo UUID de playlist como playlist_id.
  const vodFavPlaylistId = activePlaylistId
    ? `${FAVORITE_PLAYLIST_VOD}:${activePlaylistId}`
    : FAVORITE_PLAYLIST_VOD

  const [favIds, setFavIds] = useState<Set<number>>(() => {
    const rawId = playlistServiceGetActivePlaylist()?.id
    const pid = rawId ? `${FAVORITE_PLAYLIST_VOD}:${rawId}` : FAVORITE_PLAYLIST_VOD
    const stored = new Set<number>()
    for (const f of getFavorites()) {
      if (f.playlist_id === pid) stored.add(Number(f.channel_id))
    }
    return stored
  })

  // Quando o usuário troca de playlist, recarrega os favoritos da nova playlist.
  useEffect(() => {
    const stored = new Set<number>()
    for (const f of getFavorites()) {
      if (f.playlist_id === vodFavPlaylistId) stored.add(Number(f.channel_id))
    }
    setFavIds(stored)
  }, [vodFavPlaylistId])

  const { vodCategories, vodStreams, vodSourceType, m3uStreamUrls, isLoading, error } = useMoviesCatalog()

  const vodCountByCategoryId = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of vodStreams) {
      const cid = s.category_id == null ? '' : String(s.category_id)
      m.set(cid, (m.get(cid) ?? 0) + 1)
    }
    return m
  }, [vodStreams])

  const streamByVodId = useMemo(() => {
    const m = new Map<number, XtreamVodStream>()
    for (const s of vodStreams) m.set(s.stream_id, s)
    return m
  }, [vodStreams])

  const allMoviesUi = useMemo((): MovieUi[] => {
    return vodStreams.map((m, i) => ({
      id: m.stream_id,
      title: m.name,
      titleLower: m.name.toLowerCase(),
      year: resolveXtreamVodYear(m),
      rating: m.rating?.trim() || '—',
      iconUrl: m.stream_icon?.trim() || undefined,
      color: GRADIENTS[i % GRADIENTS.length]!,
    }))
  }, [vodStreams])

  const moviesByCategoryId = useMemo(() => {
    const byVodId = new Map<number, MovieUi>()
    for (const movie of allMoviesUi) byVodId.set(movie.id, movie)

    const byCategory = new Map<string, MovieUi[]>()
    byCategory.set('all', allMoviesUi)
    byCategory.set('favorites', allMoviesUi.filter((m) => favIds.has(m.id)))
    byCategory.set('continue-watching', [])

    for (const stream of vodStreams) {
      const categoryId = String(stream.category_id ?? '')
      const movie = byVodId.get(stream.stream_id)
      if (!movie) continue
      const list = byCategory.get(categoryId)
      if (list) list.push(movie)
      else byCategory.set(categoryId, [movie])
    }

    return byCategory
  }, [allMoviesUi, vodStreams, favIds])

  const categoryRows = useMemo((): CategoryRow[] => {
    const all: CategoryRow = { id: 'all', name: 'All Movies', count: vodStreams.length }
    const favorites: CategoryRow = { id: 'favorites', name: 'Favorite', count: favIds.size }
    const continueWatching: CategoryRow = { id: 'continue-watching', name: 'Continue Watching', count: 0 }
    const mapped = vodCategories.map((c) => ({
      id: String(c.category_id),
      name: c.category_name,
      count: vodCountByCategoryId.get(String(c.category_id)) ?? 0,
    }))
    return [all, favorites, continueWatching, ...mapped]
  }, [vodCategories, vodStreams.length, vodCountByCategoryId, favIds])

  const filteredCategories = useMemo(
    () => categoryRows.filter((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase())),
    [categoryRows, categorySearch],
  )

  const movies = useMemo((): MovieUi[] => {
    const selected = categoryRows[selectedCategory]
    if (!selected) return []
    const base = moviesByCategoryId.get(selected.id) ?? []
    const q = movieSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((movie) => movie.titleLower.includes(q))
  }, [categoryRows, selectedCategory, movieSearch, moviesByCategoryId])

  const categorySearchRef = useRef<HTMLInputElement | null>(null)
  const movieSearchRef = useRef<HTMLInputElement | null>(null)
  const gridPosterRef = useRef<HTMLDivElement | null>(null)
  const vodGridCols = useVodGridColumns(gridPosterRef)

  const getRealCategoryIndex = useCallback(
    (filteredIndex: number) => {
      const row = filteredCategories[filteredIndex]
      if (!row) return 0
      return categoryRows.findIndex((r) => r.id === row.id)
    },
    [filteredCategories, categoryRows],
  )

  const onCategoryActivate = useCallback((realIndex: number) => {
    setMovieSearch('')
    setSelectedCategory(realIndex)
  }, [])

  const onMovieActivate = useCallback(
    (flatIndex: number) => {
      const m = movies[flatIndex]
      if (!m) return
      const stream = streamByVodId.get(m.id)
      if (stream) setDetail(stream)
    },
    [movies, streamByVodId],
  )

  const {
    focusedCategoryIndex,
    focusedItemIndex,
    activePanel,
    onCategorySearchFocus,
    onGridSearchFocus,
    onCategoryRowBecameFocused,
    onGridItemBecameFocused,
    shellMainFocusId,
  } = useVodCatalogNavigation({
    routePath: '/movies',
    idPrefix: 'movies',
    categorySearchRef,
    gridSearchRef: movieSearchRef,
    filteredCategoryCount: filteredCategories.length,
    itemCount: movies.length,
    gridColumns: vodGridCols,
    getRealCategoryIndex,
    onCategoryActivate,
    onItemActivate: onMovieActivate,
  })
  const useCssFocusOnly = isSamsungTizenLikeRuntime()

  const vodPlan = useMemo(
    () => buildVodCatalogShellPlan(shellMainFocusId, 'movies-grid-search'),
    [shellMainFocusId],
  )

  const moviesGridScrollRef = useRef<HTMLDivElement | null>(null)
  useVodGridScrollIntoView({
    scrollRef: moviesGridScrollRef,
    idPrefix: 'movies',
    focusedItemIndex,
    activePanel,
    itemCount: movies.length,
  })
  const gridResetKey = `${selectedCategory}|${movieSearch}|${vodStreams.length}`
  const { visibleItems: moviesVisible, loadMoreRef } = useVisibleGridSlice(
    movies,
    gridResetKey,
    moviesGridScrollRef,
    focusedItemIndex,
  )
  const moviePosterUrls = useMemo(
    () => movies.map((movie) => movie.iconUrl ?? '').filter((url) => url.length > 0),
    [movies],
  )
  usePosterWarmup(moviePosterUrls, gridResetKey, focusedItemIndex)

  const prefetchedMovieDetailIds = useMemo(
    () => movies.slice(0, 240).map((movie) => movie.id),
    [movies],
  )

  useEffect(() => {
    if (prefetchedMovieDetailIds.length === 0) return
    const ac = new AbortController()
    const timer = window.setTimeout(() => {
      if (ac.signal.aborted) return
      void prefetchXtreamMovieDetails(prefetchedMovieDetailIds, vodSourceType, ac.signal)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      ac.abort()
    }
  }, [prefetchedMovieDetailIds, vodSourceType])

  const detailCategoryName = useMemo(() => {
    if (!detail?.category_id) return 'VOD'
    const row = vodCategories.find((c) => String(c.category_id) === String(detail.category_id))
    return row?.category_name ?? 'VOD'
  }, [detail, vodCategories])

  const detailPlayUrl = useMemo(() => {
    if (!detail) return null
    return resolveMoviePlayUrl(detail, vodSourceType, m3uStreamUrls)
  }, [detail, vodSourceType, m3uStreamUrls])

  /* eslint-disable react-hooks/set-state-in-effect -- VOD detail fetch state intentionally resets when the selected asset changes */
  useEffect(() => {
    if (!detail || vodSourceType !== 'xtream') {
      setVodApiDetail(null)
      setVodDetailLoading(false)
      return
    }
    let cancelled = false
    setVodApiDetail(null)
    setVodDetailLoading(true)
    void enrichXtreamMovieDetail(detail.stream_id, vodSourceType)
      .then((info) => {
        if (!cancelled) setVodApiDetail(info)
      })
      .catch(() => {
        if (!cancelled) setVodApiDetail(null)
      })
      .finally(() => {
        if (!cancelled) setVodDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detail, vodSourceType])
  /* eslint-enable react-hooks/set-state-in-effect */

  const tizenTab = isSamsungTizenLikeRuntime() ? -1 : undefined

  return (
    <FocusPlan plan={vodPlan}>
      <div className="iptv-vod-catalog-scope iptv-movies-page flex min-h-0 flex-1 flex-col surface-gradient">
      <VodDetailModal
        open={detail !== null}
        onClose={() => {
          setDetail(null)
          setVodApiDetail(null)
          setVodDetailLoading(false)
          // Restaurar foco ao grid item após fechar o modal.
          // 1. Definir imediatamente o ID no store — useVodCatalogNavigation usa
          //    tvFocusIdStore como fallback para keyEventFocusInside quando activeElement é body.
          const restoreId = `movies-mv-${focusedItemIndex}`
          tvFocusIdStore.set(restoreId)
          // 2. Após animação Radix (duration-100), aplicar foco DOM real.
          //    Timer guardado em ref e limpo no unmount para não corromper o store
          //    se o utilizador navegar para outra página antes dos 150ms.
          if (modalFocusTimerRef.current != null) clearTimeout(modalFocusTimerRef.current)
          modalFocusTimerRef.current = window.setTimeout(() => {
            modalFocusTimerRef.current = null
            if (tvFocusIdStore.get() !== restoreId) return
            const el = document.getElementById(`focus-${restoreId}`)
            if (el instanceof HTMLElement) el.focus({ preventScroll: true })
          }, 150)
        }}
        kind="movie"
        title={detail?.name ?? ''}
        posterUrl={
          detail
            ? vodApiDetail?.movie_image?.trim() || detail.stream_icon?.trim() || undefined
            : undefined
        }
        rating={detail ? vodApiDetail?.rating?.trim() || detail.rating?.trim() || '—' : '—'}
        year={detail ? vodApiDetail?.year ?? resolveXtreamVodYear(detail) : new Date().getFullYear()}
        genre={
          detail
            ? vodApiDetail?.genre?.trim() || resolveXtreamVodGenre(detail, detailCategoryName)
            : ''
        }
        duration={
          detail
            ? vodApiDetail?.durationLabel?.trim() || resolveXtreamVodDurationLabel(detail)
            : ''
        }
        description={
          detail ? vodApiDetail?.plot?.trim() || resolveXtreamVodPlot(detail) : ''
        }
        descriptionLoading={vodSourceType === 'xtream' && vodDetailLoading}
        playDisabled={!detailPlayUrl}
        isFavorite={detail ? favIds.has(detail.stream_id) : false}
        onToggleFavorite={() => {
          if (!detail) return
          const channel = vodItemToChannel({ id: detail.stream_id, title: detail.name, genre: '', iconUrl: detail.stream_icon })
          toggleFavorite(channel, vodFavPlaylistId)
          setFavIds((prev) => {
            const next = new Set(prev)
            if (next.has(detail.stream_id)) next.delete(detail.stream_id)
            else next.add(detail.stream_id)
            return next
          })
        }}
        onPlay={() => {
          if (!detail || !detailPlayUrl) return
          navigate('/player', {
            state: {
              streamUrl: detailPlayUrl,
              title: detail.name,
              channelId: `vod-${detail.stream_id}`,
              returnTo: '/movies',
            },
          })
          // Não fechar o modal aqui — a navegação desmonta o MoviesPage inteiro.
          // Fechar antes causava flash do catálogo enquanto o PlayerPage carregava.
        }}
      />

      {error ? (
        <div className="mx-0 mt-0 rounded-none border-x-0 border-t-0 border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-foreground">
          Movies load error: {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden" data-iptv-vod-main="1">
        <div className="iptv-vod-sidebar flex min-h-0 shrink-0 flex-col border-r border-border/30 glass-card">
          <div className="vod-search-strip shrink-0 border-b border-border/30">
            <TVFocusable id="movies-cat-search" focusScale={false} className="rounded-xl">
              <IptvSearchField
                ref={categorySearchRef}
                placeholder="Search categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                onFocus={(e) => {
                  moveCaretToEndOnFocus(e)
                  onCategorySearchFocus()
                }}
                tabIndex={tizenTab}
              />
            </TVFocusable>
          </div>

          <div
            tabIndex={-1}
            className="vod-cat-scroll min-h-0 flex-1 overflow-y-auto py-2 scrollbar-tv outline-none"
          >
            {isLoading ? (
              <div className="px-5 py-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading categories...
              </div>
            ) : null}
            {filteredCategories.map((cat, filteredIdx) => {
              const realIndex = categoryRows.findIndex((r) => r.id === cat.id)
              const isActive = realIndex === selectedCategory
              const isNavFocus =
                !useCssFocusOnly && activePanel === 'categories' && filteredIdx === focusedCategoryIndex
              const CategoryIcon = cat.id === 'favorites' ? Star : Tv
              return (
                <TVFocusable
                  key={`${cat.id}-${cat.name}`}
                  id={`movies-cat-${filteredIdx}`}
                  focusScale={false}
                  onBecameFocused={onCategoryRowBecameFocused}
                  className={cn(
                    'iptv-vod-cat-row-wrap flex min-h-[4rem] items-center gap-3 px-5 py-3.5 mx-2.5 rounded-2xl',
                    isActive ? 'channel-item-active glass-card-active' : 'hover:bg-muted/30',
                    isNavFocus && !isActive && 'iptv-vod-cat-row-wrap--dpad',
                    isNavFocus && isActive && 'iptv-vod-cat-row-wrap--dpad-applied',
                  )}
                >
                  <CategoryIcon
                    className={cn('w-6 h-6 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')}
                  />
                  <span
                    className={cn(
                      'iptv-vod-cat-label flex-1 text-base font-semibold truncate',
                      isActive ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {cat.name}
                  </span>
                  <span
                    className={cn(
                      'text-sm px-2.5 py-1 rounded-full',
                      isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {cat.count}
                  </span>
                </TVFocusable>
              )
            })}
          </div>
        </div>

        <div className="iptv-vod-main flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="vod-search-strip shrink-0 border-b border-border/30">
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <TVFocusable id="movies-grid-search" focusScale={false} className="rounded-xl">
                  <IptvSearchField
                    ref={movieSearchRef}
                    placeholder="Search all movies..."
                    value={movieSearch}
                    onChange={(e) => setMovieSearch(e.target.value)}
                    onFocus={onGridSearchFocus}
                    tabIndex={tizenTab}
                  />
                </TVFocusable>
              </div>
              {isLoading ? (
                <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : null}
            </div>
          </div>

          <div
            ref={moviesGridScrollRef}
            tabIndex={-1}
            className="vod-grid-scroll flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-tv outline-none"
          >
            <div className="px-6 py-4">
              {!isLoading && movies.length === 0 && (
                <div className="py-14 text-center text-base text-muted-foreground">
                  {movieSearch.trim() ? 'No movies match your search.' : 'No VOD items found for this category.'}
                </div>
              )}

              <div
                ref={gridPosterRef}
                tabIndex={-1}
                className="vod-poster-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 xl:gap-6 outline-none"
              >
                {moviesVisible.map((movie, globalIdx) => {
                  const navFocus =
                    !useCssFocusOnly && activePanel === 'grid' && focusedItemIndex === globalIdx
                  return (
                    <TVFocusable
                      key={movie.id}
                      id={`movies-mv-${globalIdx}`}
                      focusScale={false}
                      onBecameFocused={onGridItemBecameFocused}
                      className={cn(
                        'iptv-vod-poster-card group rounded-2xl overflow-hidden',
                        navFocus && 'iptv-vod-poster-card--dpad-active z-[1]',
                      )}
                    >
                      <div
                        data-tv-activate
                        className={cn(
                          'aspect-[2/3] bg-gradient-to-br rounded-2xl flex flex-col items-center justify-center relative overflow-hidden',
                          movie.iconUrl ? '' : movie.color,
                        )}
                      >
                        {movie.iconUrl ? (
                          <IptvRemoteImage
                            src={movie.iconUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            loading={globalIdx < 120 ? 'eager' : 'lazy'}
                          />
                        ) : (
                          <Film className="w-12 h-12 text-foreground/20 mb-3" />
                        )}
                        <div className="iptv-vod-poster-meta absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent">
                          <p className="iptv-vod-poster-title font-display font-semibold text-foreground truncate">
                            {movie.title}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-xs text-primary font-semibold">★ {movie.rating}</span>
                            <span className="text-xs text-muted-foreground">{movie.year}</span>
                          </div>
                        </div>
                        <div
                          className="absolute top-3 right-3 rounded-md bg-primary/20 px-2 py-1 text-[11px] font-bold text-primary"
                          aria-hidden
                        >
                          HD
                        </div>
                      </div>
                    </TVFocusable>
                  )
                })}
                {moviesVisible.length < movies.length ? (
                  <div
                    ref={loadMoreRef}
                    className="col-span-full flex min-h-[24px] items-center justify-center py-2"
                    aria-hidden
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </FocusPlan>
  )
}

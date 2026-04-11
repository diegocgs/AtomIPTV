import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVodGridColumns } from '@/hooks/useVodGridColumns'
import { useVodGridScrollIntoView } from '@/hooks/useVodGridScrollIntoView'
import { useNavigate } from 'react-router-dom'
import { Tv, Star, Loader2 } from 'lucide-react'
import IptvRemoteImage from '@/components/iptv/IptvRemoteImage'
import { IptvSearchField } from '@/components/iptv/IptvSearchField'
import VodDetailModal from '@/components/iptv/VodDetailModal'
import { useSeriesCatalog } from '@/features/catalog'
import { useVisibleGridSlice } from '@/hooks/useVisibleGridSlice'
import { usePosterWarmup } from '@/hooks/usePosterWarmup'
import { FocusPlan, TVFocusable, buildVodCatalogShellPlan, isSamsungTizenLikeRuntime } from '@/lib/tvFocus'
import { tvFocusIdStore } from '@/lib/tvFocus/tvFocusIdStore'
import { useVodCatalogNavigation } from '@/pages/vod/useVodCatalogNavigation'
import { enrichXtreamSeriesDetail, type SeriesDetailMeta } from '@/lib/vodDetailEnrichment'
import { resolveSeriesPlayUrl } from '@/lib/vodPlaybackResolve'
import { cn, moveCaretToEndOnFocus } from '@/lib/utils'
import {
  resolveXtreamSeriesGenre,
  resolveXtreamSeriesPlot,
  resolveXtreamSeriesYear,
  type XtreamSeriesStream,
} from '@/services/xtream'
import { FAVORITE_PLAYLIST_SERIES, getFavorites, toggleFavorite, vodItemToChannel } from '@/lib/favorites'
import { usePlaylists } from '@/features/playlists/hooks/usePlaylists'
import { playlistServiceGetActivePlaylist } from '@/features/playlists/services/playlistService'

type CategoryRow = {
  id: string
  name: string
  count: number
}

type SeriesUi = {
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

export default function SeriesPage() {
  const navigate = useNavigate()
  const { activePlaylistId } = usePlaylists()
  const [selectedCategory, setSelectedCategory] = useState(0)
  const [categorySearch, setCategorySearch] = useState('')
  const [seriesSearch, setSeriesSearch] = useState('')
  const [detail, setDetail] = useState<XtreamSeriesStream | null>(null)
  const [seriesApiDetail, setSeriesApiDetail] = useState<SeriesDetailMeta | null>(null)
  const [seriesDetailLoading, setSeriesDetailLoading] = useState(false)
  const [seriesPlayPending, setSeriesPlayPending] = useState(false)
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

  // playlist_id exclusivo para favoritos de séries — prefixo 'series:' evita colisão
  // com canais ao vivo que usam o mesmo UUID de playlist como playlist_id.
  const seriesFavPlaylistId = activePlaylistId
    ? `${FAVORITE_PLAYLIST_SERIES}:${activePlaylistId}`
    : FAVORITE_PLAYLIST_SERIES

  const [favIds, setFavIds] = useState<Set<number>>(() => {
    const rawId = playlistServiceGetActivePlaylist()?.id
    const pid = rawId ? `${FAVORITE_PLAYLIST_SERIES}:${rawId}` : FAVORITE_PLAYLIST_SERIES
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
      if (f.playlist_id === seriesFavPlaylistId) stored.add(Number(f.channel_id))
    }
    setFavIds(stored)
  }, [seriesFavPlaylistId])

  const { seriesCategories, seriesRows, seriesSourceType, m3uSeriesUrls, isLoading, error } = useSeriesCatalog()

  const seriesCountByCategoryId = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of seriesRows) {
      const cid = s.category_id == null ? '' : String(s.category_id)
      m.set(cid, (m.get(cid) ?? 0) + 1)
    }
    return m
  }, [seriesRows])

  const seriesRowById = useMemo(() => {
    const map = new Map<number, XtreamSeriesStream>()
    for (const s of seriesRows) map.set(s.series_id, s)
    return map
  }, [seriesRows])

  const allSeriesUi = useMemo((): SeriesUi[] => {
    return seriesRows.map((s, i) => ({
      id: s.series_id,
      title: s.name,
      titleLower: s.name.toLowerCase(),
      year: resolveXtreamSeriesYear(s),
      rating: s.rating?.trim() || '—',
      iconUrl: s.cover?.trim() || undefined,
      color: GRADIENTS[i % GRADIENTS.length]!,
    }))
  }, [seriesRows])

  const seriesByCategoryId = useMemo(() => {
    const bySeriesId = new Map<number, SeriesUi>()
    for (const item of allSeriesUi) bySeriesId.set(item.id, item)

    const byCategory = new Map<string, SeriesUi[]>()
    byCategory.set('all', allSeriesUi)
    byCategory.set('favorites', allSeriesUi.filter((s) => favIds.has(s.id)))
    byCategory.set('continue-watching', [])

    for (const row of seriesRows) {
      const categoryId = String(row.category_id ?? '')
      const item = bySeriesId.get(row.series_id)
      if (!item) continue
      const list = byCategory.get(categoryId)
      if (list) list.push(item)
      else byCategory.set(categoryId, [item])
    }

    return byCategory
  }, [allSeriesUi, seriesRows, favIds])

  const categoryRows = useMemo((): CategoryRow[] => {
    const all: CategoryRow = { id: 'all', name: 'All Series', count: seriesRows.length }
    const favorites: CategoryRow = { id: 'favorites', name: 'Favorite', count: favIds.size }
    const continueWatching: CategoryRow = { id: 'continue-watching', name: 'Continue Watching', count: 0 }
    const mapped = seriesCategories.map((c) => ({
      id: String(c.category_id),
      name: c.category_name,
      count: seriesCountByCategoryId.get(String(c.category_id)) ?? 0,
    }))
    return [all, favorites, continueWatching, ...mapped]
  }, [seriesCategories, seriesRows.length, seriesCountByCategoryId, favIds])

  const filteredCategories = useMemo(
    () => categoryRows.filter((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase())),
    [categoryRows, categorySearch],
  )

  const seriesItems = useMemo((): SeriesUi[] => {
    const selected = categoryRows[selectedCategory]
    if (!selected) return []
    const base = seriesByCategoryId.get(selected.id) ?? []
    const q = seriesSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((item) => item.titleLower.includes(q))
  }, [categoryRows, selectedCategory, seriesSearch, seriesByCategoryId])

  const categorySearchRef = useRef<HTMLInputElement | null>(null)
  const seriesSearchRef = useRef<HTMLInputElement | null>(null)
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
    setSeriesSearch('')
    setSelectedCategory(realIndex)
  }, [])

  const onSeriesActivate = useCallback(
    (flatIndex: number) => {
      const item = seriesItems[flatIndex]
      if (!item) return
      const row = seriesRowById.get(item.id)
      if (row) setDetail(row)
    },
    [seriesItems, seriesRowById],
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
    routePath: '/series',
    idPrefix: 'series',
    categorySearchRef,
    gridSearchRef: seriesSearchRef,
    filteredCategoryCount: filteredCategories.length,
    itemCount: seriesItems.length,
    gridColumns: vodGridCols,
    getRealCategoryIndex,
    onCategoryActivate,
    onItemActivate: onSeriesActivate,
  })
  const useCssFocusOnly = isSamsungTizenLikeRuntime()

  const vodPlan = useMemo(
    () => buildVodCatalogShellPlan(shellMainFocusId, 'series-grid-search'),
    [shellMainFocusId],
  )

  const seriesGridScrollRef = useRef<HTMLDivElement | null>(null)
  useVodGridScrollIntoView({
    scrollRef: seriesGridScrollRef,
    idPrefix: 'series',
    focusedItemIndex,
    activePanel,
    itemCount: seriesItems.length,
  })
  const seriesGridResetKey = `${selectedCategory}|${seriesSearch}|${seriesRows.length}`
  const { visibleItems: seriesVisible, loadMoreRef: seriesLoadMoreRef } = useVisibleGridSlice(
    seriesItems,
    seriesGridResetKey,
    seriesGridScrollRef,
    focusedItemIndex,
  )
  const seriesPosterUrls = useMemo(
    () => seriesItems.map((item) => item.iconUrl ?? '').filter((url) => url.length > 0),
    [seriesItems],
  )
  usePosterWarmup(seriesPosterUrls, seriesGridResetKey, focusedItemIndex)

  const detailCategoryName = useMemo(() => {
    if (!detail?.category_id) return 'Series'
    const row = seriesCategories.find((c) => String(c.category_id) === String(detail.category_id))
    return row?.category_name ?? 'Series'
  }, [detail, seriesCategories])

  useEffect(() => {
    if (!detail) {
      setSeriesApiDetail(null)
      setSeriesDetailLoading(false)
      return
    }
    let cancelled = false
    setSeriesApiDetail(null)
    setSeriesDetailLoading(true)
    void enrichXtreamSeriesDetail(detail.series_id, seriesSourceType)
      .then((info) => {
        if (!cancelled) setSeriesApiDetail(info)
      })
      .catch(() => {
        if (!cancelled) setSeriesApiDetail(null)
      })
      .finally(() => {
        if (!cancelled) setSeriesDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detail, seriesSourceType])

  const tizenTab = isSamsungTizenLikeRuntime() ? -1 : undefined

  return (
    <FocusPlan plan={vodPlan}>
      <div className="iptv-vod-catalog-scope iptv-series-page flex min-h-0 flex-1 flex-col surface-gradient">
      <VodDetailModal
        open={detail !== null}
        onClose={() => {
          setDetail(null)
          setSeriesApiDetail(null)
          setSeriesDetailLoading(false)
          // Restaurar foco ao grid item após fechar o modal.
          const restoreId = `series-mv-${focusedItemIndex}`
          tvFocusIdStore.set(restoreId)
          if (modalFocusTimerRef.current != null) clearTimeout(modalFocusTimerRef.current)
          modalFocusTimerRef.current = window.setTimeout(() => {
            modalFocusTimerRef.current = null
            if (tvFocusIdStore.get() !== restoreId) return
            const el = document.getElementById(`focus-${restoreId}`)
            if (el instanceof HTMLElement) el.focus({ preventScroll: true })
          }, 150)
        }}
        kind="series"
        title={detail?.name ?? ''}
        posterUrl={
          detail ? seriesApiDetail?.cover?.trim() || detail.cover?.trim() || undefined : undefined
        }
        rating={detail ? seriesApiDetail?.rating?.trim() || detail.rating?.trim() || '—' : '—'}
        year={detail ? seriesApiDetail?.year ?? resolveXtreamSeriesYear(detail) : new Date().getFullYear()}
        genre={
          detail
            ? seriesApiDetail?.genre?.trim() || resolveXtreamSeriesGenre(detail, detailCategoryName)
            : ''
        }
        duration=""
        description={
          detail ? seriesApiDetail?.plot?.trim() || resolveXtreamSeriesPlot(detail) : ''
        }
        descriptionLoading={seriesSourceType === 'xtream' && seriesDetailLoading}
        playDisabled={seriesPlayPending}
        playLabel={seriesPlayPending ? 'Loading…' : 'Play'}
        isFavorite={detail ? favIds.has(detail.series_id) : false}
        onToggleFavorite={() => {
          if (!detail) return
          const channel = vodItemToChannel({ id: detail.series_id, title: detail.name, genre: '', iconUrl: detail.cover })
          toggleFavorite(channel, seriesFavPlaylistId)
          setFavIds((prev) => {
            const next = new Set(prev)
            if (next.has(detail.series_id)) next.delete(detail.series_id)
            else next.add(detail.series_id)
            return next
          })
        }}
        onPlay={async () => {
          if (!detail) return
          setSeriesPlayPending(true)
          try {
            const url = await resolveSeriesPlayUrl(detail, seriesSourceType, m3uSeriesUrls)
            if (url) {
              navigate('/player', {
                state: {
                  streamUrl: url,
                  title: detail.name,
                  channelId: `series-${detail.series_id}`,
                  returnTo: '/series',
                },
              })
              // Não fechar o modal — a navegação desmonta o SeriesPage inteiro.
            }
          } finally {
            setSeriesPlayPending(false)
          }
        }}
      />

      {error ? (
        <div className="mx-0 mt-0 rounded-none border-x-0 border-t-0 border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-foreground">
          Series load error: {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden" data-iptv-series-main="1">
        <div className="iptv-vod-sidebar flex min-h-0 shrink-0 flex-col border-r border-border/30 glass-card">
          <div className="vod-search-strip shrink-0 border-b border-border/30">
            <TVFocusable id="series-cat-search" focusScale={false} className="rounded-xl">
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
                  id={`series-cat-${filteredIdx}`}
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
                <TVFocusable id="series-grid-search" focusScale={false} className="rounded-xl">
                  <IptvSearchField
                    ref={seriesSearchRef}
                    placeholder="Search all series..."
                    value={seriesSearch}
                    onChange={(e) => setSeriesSearch(e.target.value)}
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
            ref={seriesGridScrollRef}
            tabIndex={-1}
            className="vod-grid-scroll flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-tv outline-none"
          >
            <div className="px-6 py-4">
              {!isLoading && seriesItems.length === 0 && (
                <div className="py-14 text-center text-base text-muted-foreground">
                  {seriesSearch.trim()
                    ? 'No series match your search.'
                    : 'No series found for this category.'}
                </div>
              )}

              <div
                tabIndex={-1}
                ref={gridPosterRef}
                className="vod-poster-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 xl:gap-6 outline-none"
              >
                {seriesVisible.map((item, globalIdx) => {
                  const navFocus =
                    !useCssFocusOnly && activePanel === 'grid' && focusedItemIndex === globalIdx
                  return (
                    <TVFocusable
                      key={item.id}
                      id={`series-mv-${globalIdx}`}
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
                          item.iconUrl ? '' : item.color,
                        )}
                      >
                        {item.iconUrl ? (
                          <IptvRemoteImage
                            src={item.iconUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            loading={globalIdx < 24 ? 'eager' : 'lazy'}
                          />
                        ) : (
                          <Tv className="w-12 h-12 text-foreground/20 mb-3" />
                        )}
                        <div className="iptv-vod-poster-meta absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent">
                          <p className="iptv-vod-poster-title font-display font-semibold text-foreground truncate">
                            {item.title}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-xs text-primary font-semibold">★ {item.rating}</span>
                            <span className="text-xs text-muted-foreground">{item.year}</span>
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
                {seriesVisible.length < seriesItems.length ? (
                  <div
                    ref={seriesLoadMoreRef}
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

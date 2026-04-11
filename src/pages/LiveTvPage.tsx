import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import { PlayerSurface } from '@/features/player/components/PlayerSurface'
import { usePlayerController } from '@/features/player/hooks/usePlayerController'
import { useLiveCatalog, type LiveCategory, type LiveChannel } from '@/features/catalog'
import { usePlaylists } from '@/features/playlists/hooks/usePlaylists'
import { formatEpgRange } from '@/features/iptv/epgDisplay'
import { favoriteChannelIdSet, toggleLiveChannelFavorite } from '@/lib/favorites'
import { getLiveNavForPlaylist, setLiveNavForPlaylist } from '@/lib/liveNavUxStorage'
import { getXtreamCredentialsForApp, shouldUseXtreamApiForActivePlaylist } from '@/lib/playlistsStorage'
import {
  LIVE_ALL_CATEGORY_ID,
  LIVE_FAVORITES_CATEGORY_ID,
} from '@/features/catalog/utils/liveMappers'
import { FocusPlan, TVFocusable } from '@/lib/tvFocus'
import { buildLiveTvShellOnlyPlan } from '@/lib/tvFocus/buildLiveTvShellOnlyPlan'
import {
  isRemoteEnterKey,
  isSamsungTizenLikeRuntime,
} from '@/lib/tvFocus/tvRemoteKeys'
import { useLiveTvNavigation } from '@/pages/liveTv/useLiveTvNavigation'
import {
  fetchXtreamShortEpg,
  pickCurrentAndNextEpg,
  type XtreamCredentials,
  type XtreamShortEpgEntry,
} from '@/services/xtream'

const QUALITY_BADGES = ['HD', 'FHD', 'SD', '4K'] as const
/** Linhas montadas na DOM (janela deslizante). `visibleChannels` já inclui todos os canais (memória + snapshot IDB). */
const CHANNEL_LIST_DOM_WINDOW = 40
const LIVE_LIST_TOKEN_EDGE_SAMPLE = 12

function qualityForIndex(i: number): (typeof QUALITY_BADGES)[number] {
  return QUALITY_BADGES[i % QUALITY_BADGES.length]!
}

function buildVisibleListToken(rows: LiveChannel[]): string {
  const n = rows.length
  if (n === 0) return '0'
  const sample = Math.min(LIVE_LIST_TOKEN_EDGE_SAMPLE, n)
  const head = rows.slice(0, sample).map((r) => r.id).join('|')
  const tail = rows.slice(Math.max(0, n - sample)).map((r) => r.id).join('|')
  return `${n}:${head}:${tail}`
}

function IconCalendar() {
  return (
    <svg className="nl-preview__epg-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg className="nl-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconStar({ filled }: { filled: boolean }) {
  return (
    <svg className="nl-preview__star" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} aria-hidden>
      <path
        d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.7L12 17.8 6.8 19.4l1-5.7-4.2-4.1 5.8-.8L12 3.5z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTv() {
  return (
    <svg className="nl-ch-row__logo-fallback" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 21h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** Mesmo ícone de “Todos” para todas as categorias; estrela só em Favorites. */
const CATEGORY_ROW_ICONS = [
  function IconTvRow() {
    return (
      <svg className="nl-cat-row__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 21h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },
  function IconStarRow() {
    return (
      <svg className="nl-cat-row__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.7L12 17.8 6.8 19.4l1-5.7-4.2-4.1 5.8-.8L12 3.5z"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
] as const

export function LiveTvPage() {
  const { activePlaylistId, revision } = usePlaylists()
  const previewHostRef = useRef<HTMLDivElement>(null)
  const liveNavRestoredRef = useRef(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const isFullscreenRef = useRef(false)
  const {
    categories: liveCategories,
    channels,
    isLoading,
    error,
    emptyState,
    reload,
  } = useLiveCatalog()

  const [activeCatIndex, setActiveCatIndex] = useState(0)
  const lastCategoryFocusIdRef = useRef('lcat-0')
  const lastChannelFocusIdRef = useRef('lch-0')
  /** Canal no painel de preview — só muda com Enter na lista (ou restore da sessão). */
  const [previewChannelId, setPreviewChannelId] = useState<string | null>(null)
  const [favoritesRevision, setFavoritesRevision] = useState(0)
  const [channelQuery, setChannelQuery] = useState('')
  const [categoryQuery, setCategoryQuery] = useState('')
  const [epgLoading, setEpgLoading] = useState(false)
  const [epgListings, setEpgListings] = useState<XtreamShortEpgEntry[]>([])
  const deferredQuery = useDeferredValue(channelQuery)
  const channelSearchRef = useRef<HTMLInputElement>(null)
  const categorySearchRef = useRef<HTMLInputElement>(null)
  const categoryScrollRef = useRef<HTMLDivElement>(null)
  const channelScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    liveNavRestoredRef.current = false
  }, [activePlaylistId, revision])

  const favoriteIds = useMemo(
    () => (activePlaylistId ? favoriteChannelIdSet(activePlaylistId) : new Set<string>()),
    // `favoritesRevision` força re-leitura após toggle; `revision` cobre mudança de playlist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePlaylistId, revision, favoritesRevision],
  )

  const liveCategoriesUi = useMemo((): LiveCategory[] => {
    if (liveCategories.length === 0) return []
    const fav: LiveCategory = {
      id: LIVE_FAVORITES_CATEGORY_ID,
      name: 'Favorites',
      order: 0.5,
    }
    const allIdx = liveCategories.findIndex((c) => c.id === LIVE_ALL_CATEGORY_ID)
    if (allIdx === -1) {
      return [fav, ...liveCategories]
    }
    const allRow = liveCategories[allIdx]!
    const rest = liveCategories.filter((c) => c.id !== LIVE_ALL_CATEGORY_ID)
    return [allRow, fav, ...rest]
  }, [liveCategories])

  useEffect(() => {
    if (!activePlaylistId || liveCategoriesUi.length === 0 || channels.length === 0) return
    if (liveNavRestoredRef.current) return
    const saved = getLiveNavForPlaylist(activePlaylistId)
    liveNavRestoredRef.current = true
    if (!saved) return
    const timeoutId = window.setTimeout(() => {
      const catIdx = Math.min(Math.max(0, saved.categoryIndex), liveCategoriesUi.length - 1)
      setActiveCatIndex(catIdx)
      if (saved.channelId && channels.some((c) => c.id === saved.channelId)) {
        setPreviewChannelId(saved.channelId)
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [activePlaylistId, liveCategoriesUi, channels])

  useEffect(() => {
    if (!activePlaylistId || !liveNavRestoredRef.current) return
    const t = window.setTimeout(() => {
      setLiveNavForPlaylist(activePlaylistId, {
        categoryIndex: activeCatIndex,
        channelId: previewChannelId,
      })
    }, 400)
    return () => window.clearTimeout(t)
  }, [activePlaylistId, activeCatIndex, previewChannelId])

  const filteredCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase()
    if (!q) return liveCategoriesUi
    return liveCategoriesUi.filter((c) => c.name.toLowerCase().includes(q))
  }, [liveCategoriesUi, categoryQuery])

  const categoryChannelCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of channels) {
      m.set(c.categoryId, (m.get(c.categoryId) ?? 0) + 1)
    }
    return m
  }, [channels])

  const effectiveActiveCatIndex =
    liveCategoriesUi.length > 0
      ? Math.min(Math.max(0, activeCatIndex), liveCategoriesUi.length - 1)
      : 0

  const categoryId = liveCategoriesUi[effectiveActiveCatIndex]?.id ?? LIVE_ALL_CATEGORY_ID

  const favoritesChannelCount = useMemo(() => {
    let n = 0
    for (const c of channels) {
      if (favoriteIds.has(c.id)) n += 1
    }
    return n
  }, [channels, favoriteIds])

  const filteredByCategory = useMemo(() => {
    if (categoryId === LIVE_ALL_CATEGORY_ID) return channels
    if (categoryId === LIVE_FAVORITES_CATEGORY_ID) {
      return channels.filter((c) => favoriteIds.has(c.id))
    }
    return channels.filter((c) => c.categoryId === categoryId)
  }, [channels, categoryId, favoriteIds])

  /** Sem fallback para “Favorites” vazio — não mostrar todos os canais. */
  const filtered =
    categoryId === LIVE_FAVORITES_CATEGORY_ID
      ? filteredByCategory
      : filteredByCategory.length > 0
        ? filteredByCategory
        : channels

  const visibleChannels = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return filtered
    return filtered.filter((c) => c.name.toLowerCase().includes(q))
  }, [filtered, deferredQuery])

  const allVisibleChannelIds = useMemo(
    () => visibleChannels.map((c) => c.id),
    [visibleChannels],
  )

  const visibleListToken = useMemo(
    () => buildVisibleListToken(visibleChannels),
    [visibleChannels],
  )

  const openPlayingChannelRef = useRef<() => void>(() => {})
  const toggleFavoriteRef = useRef<() => void>(() => {})

  const firstMainFocusId = useMemo(() => {
    if (visibleChannels.length > 0) return 'lch-0'
    if (liveCategoriesUi.length > 0) return 'lcat-0'
    return 'hdr-profile'
  }, [visibleChannels.length, liveCategoriesUi.length])

  const plan = useMemo(
    () => buildLiveTvShellOnlyPlan(firstMainFocusId),
    [firstMainFocusId],
  )

  const onCategoryFocused = useCallback((id: string) => {
    lastCategoryFocusIdRef.current = id
  }, [])

  const onChannelFocused = useCallback((id: string) => {
    lastChannelFocusIdRef.current = id
  }, [])

  const openEpgPlaceholder = useCallback(() => {
    window.alert('Guia EPG detalhado ainda está em evolução. O resumo Now/Up Next já usa o EPG do provider quando disponível.')
  }, [])

  const openChannelByIdRef = useRef<(id: string) => void>(() => {})

  const {
    focusedChannelIndex,
    focusedCategoryIndex,
    activePanel,
    channelsNavFocus,
    onCategorySearchFocus,
    onChannelSearchFocus,
  } = useLiveTvNavigation({
    channelSearchRef,
    categorySearchRef,
    channelSearch: channelQuery,
    categoryCount: liveCategoriesUi.length,
    channelCount: visibleChannels.length,
    activeCatIndex: effectiveActiveCatIndex,
    setActiveCatIndex,
    previewChannelId,
    setPreviewChannelId,
    visibleListToken,
    visibleChannelIds: allVisibleChannelIds,
    setLastChannelFocusId: onChannelFocused,
    setLastCategoryFocusId: onCategoryFocused,
    onOpenPlayingChannel: () => openPlayingChannelRef.current(),
    onOpenChannelById: (id: string) => openChannelByIdRef.current(id),
    onToggleFavorite: () => toggleFavoriteRef.current(),
    onOpenEpgPlaceholder: openEpgPlaceholder,
    clearChannelSearch: () => setChannelQuery(''),
  })
  const useCssFocusOnly = isSamsungTizenLikeRuntime()

  /** Preview = canal confirmado com Enter (não segue o foco ao navegar na lista). */
  const previewChannel: LiveChannel | undefined = useMemo(() => {
    if (!previewChannelId) return undefined
    return channels.find((c) => c.id === previewChannelId)
  }, [previewChannelId, channels])

  const previewStreamUrl = previewChannel?.streamUrl ?? null
  void revision

  // Debounce de 250 ms para evitar iniciar um novo stream a cada troca rápida de canal.
  // O engine só recebe a nova URL depois do utilizador "pousar" naquele canal.
  const [debouncedPreviewStreamUrl, setDebouncedPreviewStreamUrl] = useState<string | null>(previewStreamUrl)
  useEffect(() => {
    if (!previewStreamUrl) {
      setDebouncedPreviewStreamUrl(null)
      return
    }
    const t = window.setTimeout(() => setDebouncedPreviewStreamUrl(previewStreamUrl), 250)
    return () => window.clearTimeout(t)
  }, [previewStreamUrl])
  const useHtml5PreviewEngine =
    isSamsungTizenLikeRuntime() &&
    typeof window !== 'undefined' &&
    (() => {
      try {
        return window.self !== window.top
      } catch {
        return true
      }
    })()

  const {
    isBuffering,
    error: playerError,
    engineKind,
    toggle,
    enterFullscreenDisplay,
    exitFullscreenDisplay,
  } = usePlayerController({
    containerRef: previewHostRef,
    streamUrl: debouncedPreviewStreamUrl,
    title: previewChannel?.name,
    contentRef: previewChannel?.id,
    autoPlay: true,
    preferredEngine: useHtml5PreviewEngine ? 'html5' : null,
    startMuted: useHtml5PreviewEngine,
  })

  const playingChannel = previewChannel

  const enterFullscreen = useCallback(() => {
    isFullscreenRef.current = true
    setIsFullscreen(true)
    enterFullscreenDisplay()
  }, [enterFullscreenDisplay])

  const exitFullscreen = useCallback(() => {
    isFullscreenRef.current = false
    setIsFullscreen(false)
    exitFullscreenDisplay()
  }, [exitFullscreenDisplay])

  const openChannelById = useCallback((channelId: string) => {
    const ch = channels.find((row) => row.id === channelId)
    if (!ch) return
    setPreviewChannelId(ch.id)
    enterFullscreen()
  }, [channels, enterFullscreen])

  useEffect(() => {
    openChannelByIdRef.current = openChannelById
  }, [openChannelById])

  const xtreamCredentials: XtreamCredentials | null = useMemo(() => {
    if (!shouldUseXtreamApiForActivePlaylist()) return null
    const creds = getXtreamCredentialsForApp()
    if (!creds.serverUrl || !creds.username || !creds.password) return null
    return creds
  }, [activePlaylistId, revision])

  useEffect(() => {
    let cancelled = false

    if (!playingChannel || !xtreamCredentials) {
      setEpgListings([])
      setEpgLoading(false)
      return
    }

    const numericStreamId = Number(playingChannel.originalSourceId)
    const hasNumericStreamId = Number.isFinite(numericStreamId)
    const hasEpgChannelId = Boolean(playingChannel.epgChannelId?.trim())
    if (!hasNumericStreamId && !hasEpgChannelId) {
      setEpgListings([])
      setEpgLoading(false)
      return
    }

    // Debounce de 300 ms: evita requests desnecessários ao trocar canais rapidamente.
    const fetchTimerId = window.setTimeout(() => {
      if (cancelled) return
      setEpgLoading(true)
      ;(async () => {
        try {
          const rows = await fetchXtreamShortEpg(
            xtreamCredentials,
            hasNumericStreamId ? numericStreamId : undefined,
            12,
            playingChannel.epgChannelId,
          )
          if (cancelled) return
          setEpgListings(rows)
        } catch {
          if (cancelled) return
          setEpgListings([])
        } finally {
          if (!cancelled) setEpgLoading(false)
        }
      })()
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(fetchTimerId)
    }
  }, [playingChannel, xtreamCredentials])

  const { current: epgCurrent, next: epgNext } = useMemo(
    () => pickCurrentAndNextEpg(epgListings),
    [epgListings],
  )

  const openPlayingChannel = useCallback(() => {
    if (!previewChannel) return
    enterFullscreen()
  }, [previewChannel, enterFullscreen])

  const toggleFavorite = useCallback(() => {
    if (!previewChannel || !activePlaylistId) return
    toggleLiveChannelFavorite({
      playlistId: activePlaylistId,
      channelId: previewChannel.id,
      name: previewChannel.name,
      logo: previewChannel.logo ?? '',
    })
    setFavoritesRevision((value) => value + 1)
  }, [previewChannel, activePlaylistId])

  useEffect(() => {
    openPlayingChannelRef.current = openPlayingChannel
    toggleFavoriteRef.current = toggleFavorite
  }, [openPlayingChannel, toggleFavorite])

  // Fullscreen: Back key handled via TvFocusProvider's tv-modal-escape (data-tv-modal-open on backdrop)
  useEffect(() => {
    if (!isFullscreen) return
    const onEscape = () => exitFullscreen()
    window.addEventListener('tv-modal-escape', onEscape)
    return () => window.removeEventListener('tv-modal-escape', onEscape)
  }, [isFullscreen, exitFullscreen])

  // Fullscreen: Enter/Space toggles play/pause
  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (!isFullscreenRef.current) return
      if (isRemoteEnterKey(e) || e.code === 'Space' || e.keyCode === 32) {
        e.preventDefault()
        e.stopPropagation()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isFullscreen, toggle])

  const channelListWinStart = useMemo(() => {
    const n = visibleChannels.length
    if (n === 0) return 0
    const W = CHANNEL_LIST_DOM_WINDOW
    const fi = Math.max(0, Math.min(focusedChannelIndex, n - 1))
    let s = Math.max(0, fi - Math.floor(W / 2))
    s = Math.min(s, Math.max(0, n - W))
    return s
  }, [focusedChannelIndex, visibleChannels])

  const uiChannelRows = useMemo(
    () =>
      visibleChannels.slice(
        channelListWinStart,
        channelListWinStart + CHANNEL_LIST_DOM_WINDOW,
      ),
    [visibleChannels, channelListWinStart],
  )

  const categoryDpadActive = activePanel === 'categories'
  const channelDpadActive = activePanel === 'channels' && channelsNavFocus === 'list'

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of liveCategoriesUi) m.set(c.id, c.name)
    return m
  }, [liveCategoriesUi])

  useLayoutEffect(() => {
    if (!categoryDpadActive || liveCategoriesUi.length === 0) return
    const idx = Math.max(0, Math.min(focusedCategoryIndex, liveCategoriesUi.length - 1))
    const container = categoryScrollRef.current
    const row = document.getElementById(`focus-lcat-${idx}`)
    if (!container || !row || !container.contains(row)) return
    const margin = 10
    const c = container.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    if (r.top < c.top + margin) {
      container.scrollTop += r.top - c.top - margin
    } else if (r.bottom > c.bottom - margin) {
      container.scrollTop += r.bottom - c.bottom + margin
    }
  }, [focusedCategoryIndex, categoryDpadActive, liveCategoriesUi.length])

  useLayoutEffect(() => {
    if (!channelDpadActive || visibleChannels.length === 0) return
    const idx = Math.max(0, Math.min(focusedChannelIndex, visibleChannels.length - 1))
    const container = channelScrollRef.current
    const row = document.getElementById(`focus-lch-${idx}`)
    if (!container || !row || !container.contains(row)) return
    const margin = 10
    const c = container.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    if (r.top < c.top + margin) {
      container.scrollTop += r.top - c.top - margin
    } else if (r.bottom > c.bottom - margin) {
      container.scrollTop += r.bottom - c.bottom + margin
    }
  }, [focusedChannelIndex, channelDpadActive, visibleChannels.length])

  useEffect(() => {
    const nc = liveCategoriesUi.length
    const nch = visibleChannels.length
    if (nch === 0) {
      lastChannelFocusIdRef.current = 'lch-0'
    } else {
      const match = /^lch-(\d+)$/.exec(lastChannelFocusIdRef.current)
      const idx = match ? parseInt(match[1]!, 10) : 0
      lastChannelFocusIdRef.current = `lch-${Math.min(Math.max(0, idx), nch - 1)}`
    }
    if (nc > 0) {
      const match = /^lcat-(\d+)$/.exec(lastCategoryFocusIdRef.current)
      const idx = match ? parseInt(match[1]!, 10) : 0
      lastCategoryFocusIdRef.current = `lcat-${Math.min(Math.max(0, idx), nc - 1)}`
    }
  }, [liveCategoriesUi.length, visibleChannels.length])

  const dataHint =
    emptyState.reason === 'no_active_playlist'
      ? 'Seleccione uma playlist em Playlists para carregar canais.'
      : emptyState.reason === 'no_channels' && !isLoading
        ? emptyState.message ?? 'Nenhum canal disponível nesta playlist.'
        : null

  return (
    <FocusPlan plan={plan}>
      <div
        className="live-nexus-scope nl-live-page surface-gradient"
        data-live-tv-page="1"
        data-iptv-live-columns
      >
        {isLoading && channels.length === 0 ? (
          <p className="nl-empty-hint" aria-live="polite">
            A carregar canais…
          </p>
        ) : null}
        {error ? (
          <div className="nl-error-banner" role="alert">
            {error}{' '}
            <button
              type="button"
              className="nl-preview__btn nl-preview__btn--secondary"
              onClick={() => void reload()}
            >
              Tentar novamente
            </button>
          </div>
        ) : null}
        {dataHint && !error ? (
          <p className="nl-empty-hint" role="status">
            {dataHint}{' '}
            {emptyState.reason === 'no_active_playlist' ? (
              <Link to="/playlists" className="nl-link-btn">
                Ir para Playlists
              </Link>
            ) : null}
          </p>
        ) : null}

        <div className="nl-live-columns">
          <div className="nl-col-cats glass-card">
            <div className="nl-cat-panel-inner">
              <div className="nl-search-strip">
                <TVFocusable id="lcat-search" focusScale={false}>
                  <div className="nl-search-wrap">
                    <IconSearch />
                    <input
                      ref={categorySearchRef}
                      className="nl-search-input"
                      type="search"
                      placeholder="Search categories..."
                      value={categoryQuery}
                      onChange={(e) => setCategoryQuery(e.target.value)}
                      onFocus={onCategorySearchFocus}
                      aria-label="Search categories"
                      tabIndex={isSamsungTizenLikeRuntime() ? -1 : undefined}
                    />
                  </div>
                </TVFocusable>
              </div>
              <div ref={categoryScrollRef} className="nl-scroll-list scrollbar-tv">
                {liveCategoriesUi.length === 0 ? (
                  <p className="nl-empty-hint" style={{ margin: '0.75rem 1rem' }}>
                    Sem categorias.
                  </p>
                ) : (
                  filteredCategories.map((cat) => {
                    const i = liveCategoriesUi.indexOf(cat)
                    const applied = i === activeCatIndex
                    const navFocus = !useCssFocusOnly && categoryDpadActive && i === focusedCategoryIndex
                    const Icon =
                      cat.id === LIVE_FAVORITES_CATEGORY_ID
                        ? CATEGORY_ROW_ICONS[1]!
                        : CATEGORY_ROW_ICONS[0]!
                    const count =
                      cat.id === LIVE_ALL_CATEGORY_ID
                        ? channels.length
                        : cat.id === LIVE_FAVORITES_CATEGORY_ID
                          ? favoritesChannelCount
                          : categoryChannelCounts.get(cat.id) ?? 0
                    const accent = applied || navFocus
                    return (
                      <TVFocusable
                        key={cat.id}
                        id={`lcat-${i}`}
                        focusScale={false}
                        className="nl-cat-row-wrap"
                        onBecameFocused={onCategoryFocused}
                      >
                        <div
                          className={[
                            'nl-cat-row',
                            applied ? 'channel-item-active glass-card-active' : '',
                            accent ? 'nl-cat-row--accent' : 'nl-cat-row--muted',
                            navFocus ? 'nl-cat-row--nav' : '',
                            applied ? 'nl-cat-row--applied' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          data-tv-activate
                          role="button"
                          onClick={() => setActiveCatIndex(i)}
                        >
                          <Icon />
                          <span className="nl-cat-row__name">{cat.name}</span>
                          <span
                            className={[
                              'nl-cat-row__count',
                              accent ? '' : 'nl-cat-row__count--muted',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {count}
                          </span>
                        </div>
                      </TVFocusable>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="nl-col-channels">
            <div className="nl-search-strip nl-search-strip--channels">
              <TVFocusable id="lch-search" focusScale={false}>
                <div className="nl-search-wrap">
                  <IconSearch />
                  <input
                    ref={channelSearchRef}
                    className="nl-search-input"
                    type="search"
                    placeholder="Search all channels..."
                    value={channelQuery}
                    onChange={(e) => setChannelQuery(e.target.value)}
                    onFocus={onChannelSearchFocus}
                    aria-label="Search channels"
                    tabIndex={isSamsungTizenLikeRuntime() ? -1 : undefined}
                  />
                </div>
              </TVFocusable>
            </div>
            <div className="nl-channel-list-inner">
              <div ref={channelScrollRef} className="nl-scroll-list scrollbar-tv">
                {visibleChannels.length === 0 ? (
                  <p className="nl-empty-hint" style={{ margin: '1.5rem', textAlign: 'center' }}>
                    Nenhum canal nesta vista.
                  </p>
                ) : (
                  uiChannelRows.map((ch, i) => {
                    const globalIdx = channelListWinStart + i
                    const playing = previewChannel?.id === ch.id
                    const navFocus = !useCssFocusOnly && channelDpadActive && globalIdx === focusedChannelIndex
                    const q = qualityForIndex(globalIdx)
                    const catLabel = categoryNameById.get(ch.categoryId) ?? ch.categoryId
                    const accent = playing || navFocus
                    return (
                      <TVFocusable
                        key={`${ch.id}-${globalIdx}`}
                        id={`lch-${globalIdx}`}
                        focusScale={false}
                        className="nl-ch-row-wrap"
                        onBecameFocused={onChannelFocused}
                      >
                        <div
                          className={[
                            'nl-ch-row',
                            playing ? 'glass-card-active channel-item-active' : '',
                            navFocus ? 'nl-ch-row--nav' : '',
                            playing ? 'nl-ch-row--playing' : '',
                            accent ? 'nl-ch-row--accent-num' : 'nl-ch-row--muted-num',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          data-tv-activate
                          role="button"
                          onClick={() => {
                            if (previewChannelId === ch.id) {
                              enterFullscreen()
                            } else {
                              setPreviewChannelId(ch.id)
                            }
                          }}
                        >
                          <span className="nl-ch-row__num">{ch.number ?? globalIdx + 1}</span>
                          <span className="nl-ch-row__logo">
                            {ch.logo ? <img src={ch.logo} alt="" loading="lazy" /> : <IconTv />}
                          </span>
                          <span className="nl-ch-row__text">
                            <span className="nl-ch-row__cat">{catLabel}</span>
                            <span className="nl-ch-row__name">{ch.name}</span>
                          </span>
                          {ch.isLive ? (
                            <span className="nl-ch-row__live-dot" aria-hidden title="Live" />
                          ) : null}
                          {favoriteIds.has(ch.id) ? (
                            <span className="nl-ch-row__fav-star" aria-hidden>
                              <IconStar filled />
                            </span>
                          ) : null}
                          <span className={`nl-ch-row__q nl-ch-row__q--${q.toLowerCase()}`}>{q}</span>
                        </div>
                      </TVFocusable>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="nl-col-preview glass-card">
            <div className="nl-preview">
              <div className="nl-preview__datetime" aria-hidden>
                <span className="nl-preview__clock" />
                <span>
                  {new Date().toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <TVFocusable id="lpv-0" focusScale={false}>
                <div
                  className="nl-preview__video-outer"
                  data-tv-activate={playingChannel ? '1' : undefined}
                  role={playingChannel ? 'button' : undefined}
                  onClick={() => {
                    if (!playingChannel) return
                    enterFullscreen()
                  }}
                >
                  <div className="nl-preview__video-aspect">
                    {/* PlayerSurface deve estar SEMPRE na DOM para o usePlayerController
                        criar o engine no Effect 1. Se for condicional, o ref fica null
                        quando o Effect 1 corre e o engine nunca é criado. */}
                    <PlayerSurface ref={previewHostRef} data-testid="live-preview-surface" />
                    {isBuffering && (
                      <div className="nl-preview__buffering-overlay" aria-hidden>
                        <span className="nl-preview__buffering-spinner" />
                      </div>
                    )}
                    <div className="nl-preview__status" aria-live="polite">
                      {engineKind === 'avplay' ? <span>AV Play</span> : null}
                      {playerError ? <span>{playerError}</span> : null}
                    </div>
                    {!playingChannel && (
                      <div className="nl-preview__empty">Sem canal selecionado</div>
                    )}
                  </div>
                </div>
              </TVFocusable>

              <div className="nl-preview__body">
                <div className="nl-preview__scroll scrollbar-tv">
                  {playingChannel ? (
                    <>
                      <div>
                        <span
                          className="nl-preview__info-cat"
                          title={categoryNameById.get(playingChannel.categoryId)}
                        >
                          {categoryNameById.get(playingChannel.categoryId) ?? playingChannel.categoryId}
                        </span>
                        <h2 className="nl-preview__info-title">{playingChannel.name}</h2>
                        <p className="nl-preview__info-now">
                          <span className="nl-preview__info-now-label">Now: </span>
                          {epgLoading && !epgCurrent && !epgNext
                            ? 'Loading program guide…'
                            : epgCurrent?.title?.trim() || 'No program guide for this channel.'}
                        </p>
                        {epgCurrent ? (
                          <p className="nl-preview__info-muted">
                            {formatEpgRange(epgCurrent.startSec, epgCurrent.endSec)}
                          </p>
                        ) : null}
                      </div>
                      <div className="nl-preview__up-next glass-card">
                        <span className="nl-preview__up-next-label">Up Next</span>
                        <p className="nl-preview__up-next-title">
                          {epgLoading && !epgCurrent && !epgNext
                            ? 'Loading…'
                            : epgNext?.title?.trim() || 'No upcoming listings from the provider.'}
                        </p>
                        {epgNext ? (
                          <p className="nl-preview__info-muted">
                            {formatEpgRange(epgNext.startSec, epgNext.endSec)}
                          </p>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="nl-preview__info-muted">
                      No channels to preview. Load a playlist or pick another category.
                    </p>
                  )}
                </div>

                <div className="nl-preview__grid-actions">
                  <TVFocusable id="lpv-1" focusScale={false} className="nl-preview__btn-wrap">
                    <div
                      className="nl-preview__btn"
                      data-tv-activate
                      role="button"
                      onClick={toggleFavorite}
                    >
                      <IconStar filled={playingChannel ? favoriteIds.has(playingChannel.id) : false} />
                      <span>
                        {playingChannel && favoriteIds.has(playingChannel.id) ? 'Favorited' : 'Favorite'}
                      </span>
                    </div>
                  </TVFocusable>
                  <TVFocusable id="lpv-2" focusScale={false} className="nl-preview__btn-wrap">
                    <div
                      className="nl-preview__btn nl-preview__btn--secondary"
                      data-tv-activate
                      role="button"
                      onClick={openEpgPlaceholder}
                    >
                      <IconCalendar />
                      <span>EPG</span>
                    </div>
                  </TVFocusable>
                </div>

                <div className="nl-preview__legend" aria-hidden>
                  {[
                    { c: 'nl-preview__legend-dot--movies', t: 'Movies' },
                    { c: 'nl-preview__legend-dot--series', t: 'Series' },
                    { c: 'nl-preview__legend-dot--fav', t: 'Favorite' },
                  ].map(({ c, t }) => (
                    <div key={t} className="nl-preview__legend-item">
                      <span className={`nl-preview__legend-dot ${c}`} />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {isFullscreen && (
        <div
          className="live-fullscreen-backdrop"
          data-tv-modal-open="1"
          onClick={exitFullscreen}
          aria-hidden
        />
      )}
    </FocusPlan>
  )
}

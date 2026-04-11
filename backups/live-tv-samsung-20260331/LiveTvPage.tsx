import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlayerSurface } from '@/features/player/components/PlayerSurface'
import { usePlayerController } from '@/features/player/hooks/usePlayerController'
import { useLiveCatalog, type LiveChannel } from '@/features/catalog'
import { LIVE_ALL_CATEGORY_ID } from '@/features/catalog/utils/liveMappers'
import { FocusPlan, TVFocusable } from '@/lib/tvFocus'
import { buildLiveTvShellOnlyPlan } from '@/lib/tvFocus/buildLiveTvShellOnlyPlan'
import { isSamsungTizenLikeRuntime } from '@/lib/tvFocus/tvRemoteKeys'
import { useLiveTvNavigation } from '@/pages/liveTv/useLiveTvNavigation'

const QUALITY_BADGES = ['HD', 'FHD', 'SD', '4K'] as const
const MAX_LIVE_TV_LIST_ROWS = 2500

function qualityForIndex(i: number): (typeof QUALITY_BADGES)[number] {
  return QUALITY_BADGES[i % QUALITY_BADGES.length]!
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
  function IconClockRow() {
    return (
      <svg className="nl-cat-row__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8.25V12l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },
  function IconFilmRow() {
    return (
      <svg className="nl-cat-row__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  },
] as const

export function LiveTvPage() {
  const navigate = useNavigate()
  const previewHostRef = useRef<HTMLDivElement>(null)
  const {
    categories: liveCategories,
    channels,
    isLoading,
    error,
    emptyState,
    reload,
  } = useLiveCatalog()

  const [activeCatIndex, setActiveCatIndex] = useState(0)
  const [, setLastCategoryFocusId] = useState('lcat-0')
  const [, setLastChannelFocusId] = useState('lch-0')
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set())
  const [channelQuery, setChannelQuery] = useState('')
  const [categoryQuery, setCategoryQuery] = useState('')
  const deferredQuery = useDeferredValue(channelQuery)
  const channelSearchRef = useRef<HTMLInputElement>(null)
  const categorySearchRef = useRef<HTMLInputElement>(null)
  const categoryScrollRef = useRef<HTMLDivElement>(null)
  const channelScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (liveCategories.length === 0) return
    if (activeCatIndex >= liveCategories.length) {
      setActiveCatIndex(0)
    }
  }, [liveCategories.length, activeCatIndex])

  const filteredCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase()
    if (!q) return liveCategories
    return liveCategories.filter((c) => c.name.toLowerCase().includes(q))
  }, [liveCategories, categoryQuery])

  const categoryChannelCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of channels) {
      m.set(c.categoryId, (m.get(c.categoryId) ?? 0) + 1)
    }
    return m
  }, [channels])

  const categoryId = liveCategories[activeCatIndex]?.id ?? LIVE_ALL_CATEGORY_ID

  const filteredByCategory = useMemo(() => {
    if (categoryId === LIVE_ALL_CATEGORY_ID) return channels
    return channels.filter((c) => c.categoryId === categoryId)
  }, [channels, categoryId])

  const filtered =
    filteredByCategory.length > 0 ? filteredByCategory : channels

  const visibleChannels = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return filtered
    return filtered.filter((c) => c.name.toLowerCase().includes(q))
  }, [filtered, deferredQuery])

  const uiChannelRows = useMemo(
    () => visibleChannels.slice(0, MAX_LIVE_TV_LIST_ROWS),
    [visibleChannels],
  )
  const listTruncated = visibleChannels.length > uiChannelRows.length

  const playingChannelId = useMemo(() => {
    if (visibleChannels.length === 0) return null
    if (
      selectedChannelId &&
      visibleChannels.some((c) => c.id === selectedChannelId)
    ) {
      return selectedChannelId
    }
    return visibleChannels[0]!.id
  }, [visibleChannels, selectedChannelId])

  const playingChannel: LiveChannel | undefined = useMemo(() => {
    if (playingChannelId == null) return undefined
    return visibleChannels.find((c) => c.id === playingChannelId) ?? visibleChannels[0]
  }, [playingChannelId, visibleChannels])

  const previewStreamUrl = playingChannel?.streamUrl ?? null

  const { isBuffering, error: playerError, engineKind } = usePlayerController({
    containerRef: previewHostRef,
    streamUrl: previewStreamUrl,
    title: playingChannel?.name,
    contentRef: playingChannel?.id,
    autoPlay: true,
  })

  const firstMainFocusId = useMemo(() => {
    if (uiChannelRows.length > 0) return 'lch-0'
    if (liveCategories.length > 0) return 'lcat-0'
    return 'hdr-logo'
  }, [uiChannelRows.length, liveCategories.length])

  const plan = useMemo(
    () => buildLiveTvShellOnlyPlan(firstMainFocusId),
    [firstMainFocusId],
  )

  const visibleChannelIds = useMemo(
    () => uiChannelRows.map((c) => c.id),
    [uiChannelRows],
  )

  const openPlayingChannel = useCallback(() => {
    if (!playingChannel) return
    navigate('/player', {
      state: {
        streamUrl: playingChannel.streamUrl,
        title: playingChannel.name,
        channelId: playingChannel.id,
      },
    })
  }, [navigate, playingChannel])

  const onCategoryFocused = useCallback((id: string) => {
    setLastCategoryFocusId(id)
  }, [])

  const onChannelFocused = useCallback((id: string) => {
    setLastChannelFocusId(id)
  }, [])

  const toggleFavorite = useCallback(() => {
    if (!playingChannel) return
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (next.has(playingChannel.id)) next.delete(playingChannel.id)
      else next.add(playingChannel.id)
      return next
    })
  }, [playingChannel])

  const openEpgPlaceholder = useCallback(() => {
    window.alert('Guia EPG — integração futura (mesmo fluxo que o app legado).')
  }, [])

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
    categoryCount: liveCategories.length,
    channelCount: uiChannelRows.length,
    activeCatIndex,
    setActiveCatIndex,
    playingChannelId,
    setSelectedChannelId,
    visibleChannelIds,
    setLastChannelFocusId,
    setLastCategoryFocusId,
    onOpenPlayingChannel: openPlayingChannel,
    onToggleFavorite: toggleFavorite,
    onOpenEpgPlaceholder: openEpgPlaceholder,
    clearChannelSearch: () => setChannelQuery(''),
  })

  const categoryDpadActive = activePanel === 'categories'
  const channelDpadActive = activePanel === 'channels' && channelsNavFocus === 'list'

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of liveCategories) m.set(c.id, c.name)
    return m
  }, [liveCategories])

  useLayoutEffect(() => {
    if (!categoryDpadActive || liveCategories.length === 0) return
    const idx = Math.max(0, Math.min(focusedCategoryIndex, liveCategories.length - 1))
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
  }, [focusedCategoryIndex, categoryDpadActive, liveCategories.length])

  useLayoutEffect(() => {
    if (!channelDpadActive || uiChannelRows.length === 0) return
    const idx = Math.max(0, Math.min(focusedChannelIndex, uiChannelRows.length - 1))
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
  }, [focusedChannelIndex, channelDpadActive, uiChannelRows.length])

  useEffect(() => {
    const nc = liveCategories.length
    const nch = uiChannelRows.length
    setLastChannelFocusId((prev) => {
      if (nch === 0) return 'lch-0'
      const m = /^lch-(\d+)$/.exec(prev)
      const idx = m ? parseInt(m[1]!, 10) : 0
      return `lch-${Math.min(Math.max(0, idx), nch - 1)}`
    })
    setLastCategoryFocusId((prev) => {
      if (nc === 0) return prev
      const m = /^lcat-(\d+)$/.exec(prev)
      const idx = m ? parseInt(m[1]!, 10) : 0
      return `lcat-${Math.min(Math.max(0, idx), nc - 1)}`
    })
  }, [liveCategories.length, uiChannelRows.length])

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
                {liveCategories.length === 0 ? (
                  <p className="nl-empty-hint" style={{ margin: '0.75rem 1rem' }}>
                    Sem categorias.
                  </p>
                ) : (
                  filteredCategories.map((cat) => {
                    const i = liveCategories.indexOf(cat)
                    const applied = i === activeCatIndex
                    const navFocus = categoryDpadActive && i === focusedCategoryIndex
                    const Icon = CATEGORY_ROW_ICONS[Math.abs(i) % CATEGORY_ROW_ICONS.length]!
                    const count =
                      cat.id === LIVE_ALL_CATEGORY_ID
                        ? channels.length
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
              <div className="nl-channel-list-header">
                <span>
                  Total Channels: {visibleChannels.length}
                  {listTruncated
                    ? ` · A mostrar ${uiChannelRows.length} (use a pesquisa para filtrar)`
                    : ''}
                </span>
              </div>
              <div ref={channelScrollRef} className="nl-scroll-list scrollbar-tv">
                {visibleChannels.length === 0 ? (
                  <p className="nl-empty-hint" style={{ margin: '1.5rem', textAlign: 'center' }}>
                    Nenhum canal nesta vista.
                  </p>
                ) : (
                  uiChannelRows.map((ch, i) => {
                    const playing = playingChannelId === ch.id
                    const navFocus = channelDpadActive && i === focusedChannelIndex
                    const q = qualityForIndex(i)
                    const catLabel = categoryNameById.get(ch.categoryId) ?? ch.categoryId
                    const accent = playing || navFocus
                    return (
                      <TVFocusable
                        key={`${ch.id}-${i}`}
                        id={`lch-${i}`}
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
                            setSelectedChannelId(ch.id)
                            navigate('/player', {
                              state: {
                                streamUrl: ch.streamUrl,
                                title: ch.name,
                                channelId: ch.id,
                              },
                            })
                          }}
                        >
                          <span className="nl-ch-row__num">{ch.number ?? i + 1}</span>
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
                    navigate('/player', {
                      state: {
                        streamUrl: playingChannel.streamUrl,
                        title: playingChannel.name,
                        channelId: playingChannel.id,
                      },
                    })
                  }}
                >
                  <div className="nl-preview__video-aspect">
                    {playingChannel ? (
                      <>
                        <PlayerSurface ref={previewHostRef} data-testid="live-preview-surface" />
                        <div className="nl-preview__status" aria-live="polite">
                          {engineKind === 'avplay' ? <span>AV Play</span> : null}
                          {isBuffering ? <span>A buffer…</span> : null}
                          {playerError ? <span>{playerError}</span> : null}
                        </div>
                      </>
                    ) : (
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
                          No program guide for this channel.
                        </p>
                      </div>
                      <div className="nl-preview__up-next glass-card">
                        <span className="nl-preview__up-next-label">Up Next</span>
                        <p className="nl-preview__up-next-title">
                          No upcoming listings from the provider.
                        </p>
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
    </FocusPlan>
  )
}

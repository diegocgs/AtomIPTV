import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlayerPlaceholder } from '@/features/player'
import { useLiveCatalog, type LiveChannel } from '@/features/catalog'
import { guessPlaybackContentType } from '@/features/catalog/utils/guessPlaybackContentType'
import { LIVE_ALL_CATEGORY_ID } from '@/features/catalog/utils/liveMappers'
import { FocusPlan, TVFocusable } from '@/lib/tvFocus'
import { buildLiveTvShellOnlyPlan } from '@/lib/tvFocus/buildLiveTvShellOnlyPlan'
import { isSamsungTizenLikeRuntime } from '@/lib/tvFocus/tvRemoteKeys'
import { useLiveTvNavigation } from '@/pages/liveTv/useLiveTvNavigation'

const QUALITY_BADGES = ['HD', 'FHD', 'SD'] as const

/** Evita travar o browser: o plano de foco e o DOM não suportam centenas de milhares de linhas. */
const MAX_LIVE_TV_LIST_ROWS = 2500

function qualityForIndex(i: number): (typeof QUALITY_BADGES)[number] {
  return QUALITY_BADGES[i % QUALITY_BADGES.length]!
}

function IconSearch() {
  return (
    <svg className="live-search__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconStar({ filled }: { filled: boolean }) {
  return (
    <svg className="live-preview__star" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} aria-hidden>
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
    <svg className="live-cat-row__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 21h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function LiveTvPage() {
  const navigate = useNavigate()
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
  /** Escolha explícita do utilizador; quando inválida para a lista filtrada, volta ao 1.º canal visível. */
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set())
  const [channelQuery, setChannelQuery] = useState('')
  const deferredQuery = useDeferredValue(channelQuery)
  const channelSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (liveCategories.length === 0) return
    if (activeCatIndex >= liveCategories.length) {
      setActiveCatIndex(0)
    }
  }, [liveCategories.length, activeCatIndex])

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
    const m = /^lcat-(\d+)$/.exec(id)
    if (m) {
      const idx = parseInt(m[1]!, 10)
      if (!Number.isNaN(idx) && liveCategories[idx]) setActiveCatIndex(idx)
    }
  }, [liveCategories])

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

  useLiveTvNavigation({
    channelSearchRef,
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
      <div className="live-screen live-screen--legacy" data-live-tv-page="1">
        <h1 className="live-screen__title">Live TV</h1>

        {isLoading && channels.length === 0 ? (
          <p className="live-empty-hint" aria-live="polite">
            A carregar canais…
          </p>
        ) : null}
        {error ? (
          <p className="live-empty-hint" role="alert">
            {error}{' '}
            <button type="button" className="live-preview__btn" onClick={() => void reload()}>
              Tentar novamente
            </button>
          </p>
        ) : null}
        {dataHint && !error ? (
          <p className="live-empty-hint" role="status">
            {dataHint}{' '}
            {emptyState.reason === 'no_active_playlist' ? (
              <Link to="/playlists" className="live-preview__btn live-preview__btn--secondary">
                Ir para Playlists
              </Link>
            ) : null}
          </p>
        ) : null}

        <div className="live-columns" data-live-columns>
          <div className="live-column live-column--cats">
            <div className="live-column__search">
              <div className="live-search live-search--disabled">
                <IconSearch />
                <input
                  className="live-search__input"
                  type="search"
                  placeholder="Search categories…"
                  disabled
                  readOnly
                  aria-label="Search categories (fase 1 — lista completa)"
                />
              </div>
            </div>
            <div className="live-column__scroll live-column__scroll--cats">
              {liveCategories.map((cat, i) => {
                const applied = i === activeCatIndex
                return (
                  <TVFocusable
                    key={cat.id}
                    id={`lcat-${i}`}
                    onBecameFocused={onCategoryFocused}
                  >
                    <div
                      className={`live-cat-row ${applied ? 'live-cat-row--applied' : ''}`}
                      data-tv-activate
                      role="button"
                      onClick={() => setActiveCatIndex(i)}
                    >
                      <IconTv />
                      <span className="live-cat-row__name">{cat.name}</span>
                    </div>
                  </TVFocusable>
                )
              })}
            </div>
          </div>

          <div className="live-column live-column--channels">
            <div className="live-column__search">
              <TVFocusable id="lch-search">
                <div className="live-search">
                  <IconSearch />
                  <input
                    ref={channelSearchRef}
                    className="live-search__input"
                    type="search"
                    placeholder="Search all channels…"
                    value={channelQuery}
                    onChange={(e) => setChannelQuery(e.target.value)}
                    aria-label="Search channels"
                    tabIndex={isSamsungTizenLikeRuntime() ? -1 : undefined}
                  />
                </div>
              </TVFocusable>
            </div>
            <div className="live-channels__meta">
              <span className="live-channels__total">
                Total channels: {visibleChannels.length}
                {listTruncated
                  ? ` · A mostrar ${uiChannelRows.length} (use a pesquisa para filtrar)`
                  : ''}
              </span>
            </div>
            <div className="live-column__scroll live-column__scroll--channels">
              {visibleChannels.length === 0 ? (
                <p className="live-empty-hint">Nenhum canal nesta vista.</p>
              ) : (
                uiChannelRows.map((ch, i) => {
                  const playing = playingChannelId === ch.id
                  const q = qualityForIndex(i)
                  return (
                    <TVFocusable
                      key={`${ch.id}-${i}`}
                      id={`lch-${i}`}
                      onBecameFocused={onChannelFocused}
                    >
                      <div
                        className={`live-channel-row ${playing ? 'live-channel-row--playing' : ''}`}
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
                        <span className="live-channel-row__num">{ch.number ?? i + 1}</span>
                        <span className="live-channel-row__logo-wrap">
                          <img src={ch.logo || ''} alt="" loading="lazy" />
                        </span>
                        <span className="live-channel-row__name">{ch.name}</span>
                        <span className={`live-channel-row__q live-channel-row__q--${q.toLowerCase()}`}>
                          {q}
                        </span>
                        {favoriteIds.has(ch.id) ? (
                          <span className="live-channel-row__fav" aria-hidden>
                            ★
                          </span>
                        ) : null}
                      </div>
                    </TVFocusable>
                  )
                })
              )}
            </div>
          </div>

          <div className="live-column live-column--preview">
            <div className="live-preview">
              <TVFocusable id="lpv-0">
                <div
                  className="live-preview__video-wrap"
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
                  {playingChannel ? (
                    <>
                      <div className="live-preview__video-inner">
                        <PlayerPlaceholder
                          source={{
                            uri: playingChannel.streamUrl,
                            contentType: guessPlaybackContentType(playingChannel.streamUrl),
                          }}
                          title={playingChannel.name}
                        />
                      </div>
                      <p className="live-preview__channel-label">{playingChannel.name}</p>
                    </>
                  ) : (
                    <div className="live-preview__empty">Sem canal selecionado</div>
                  )}
                </div>
              </TVFocusable>

              <TVFocusable id="lpv-1">
                <div
                  className="live-preview__btn"
                  data-tv-activate
                  role="button"
                  onClick={toggleFavorite}
                >
                  <IconStar filled={playingChannel ? favoriteIds.has(playingChannel.id) : false} />
                  <span>Favorito</span>
                </div>
              </TVFocusable>

              <TVFocusable id="lpv-2">
                <div
                  className="live-preview__btn live-preview__btn--secondary"
                  data-tv-activate
                  role="button"
                  onClick={openEpgPlaceholder}
                >
                  <span className="live-preview__epg-icon" aria-hidden>
                    ≡
                  </span>
                  <span>Guia EPG</span>
                </div>
              </TVFocusable>

              <div className="live-preview__epg-mock" aria-hidden>
                <p className="live-preview__epg-line">
                  <strong>Agora</strong> — Programa em destaque (mock)
                </p>
                <p className="live-preview__epg-line live-preview__epg-line--muted">
                  A seguir — Próximo slot (mock)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FocusPlan>
  )
}

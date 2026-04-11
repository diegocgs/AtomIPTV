import { flushSync } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import { useTvFocus } from '@/lib/tvFocus'
import { tvFocusIdStore } from '@/lib/tvFocus/tvFocusIdStore'
import {
  isRemoteBackKey,
  isRemoteEnterKey,
  isRemoteYellowKey,
  isSamsungTizenLikeRuntime,
  mapRemoteKeyToDirection,
} from '@/lib/tvFocus/tvRemoteKeys'

export type LiveTvNavPanel = 'categories' | 'channels' | 'preview'

const PREVIEW_FOCUS_VIDEO = 0
const PREVIEW_FOCUS_FAVORITE = 1
const PREVIEW_FOCUS_EPG = 2

function focusElementByFocusId(id: string): void {
  const el = document.getElementById(`focus-${id}`)
  if (el instanceof HTMLElement) el.focus({ preventScroll: true })
}

function syncFocusTarget(id: string, setFocusedId: (id: string | null) => void): void {
  setFocusedId(id)
  window.setTimeout(() => {
    focusElementByFocusId(id)
  }, 0)
}

function focusHeaderFirstControl(): void {
  focusElementByFocusId('hdr-profile')
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable
}

function activateCurrentTvTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const direct = el.closest<HTMLElement>('[data-tv-activate]')
  if (direct) {
    direct.click()
    return true
  }
  const nested = el.querySelector<HTMLElement>('[data-tv-activate]')
  if (nested) {
    nested.click()
    return true
  }
  return false
}

type Params = {
  channelSearchRef: RefObject<HTMLInputElement | null>
  categorySearchRef?: RefObject<HTMLInputElement | null>
  channelSearch: string
  categoryCount: number
  channelCount: number
  activeCatIndex: number
  setActiveCatIndex: (i: number) => void
  /** Canal em reprodução no preview; só muda por Enter na lista (ou restore). */
  previewChannelId: string | null
  setPreviewChannelId: (id: string | null) => void
  /** Muda quando a lista visível muda (categoria/pesquisa) — re-posiciona foco sem seguir o D-pad. */
  visibleListToken: string
  visibleChannelIds: string[]
  setLastChannelFocusId: (id: string) => void
  setLastCategoryFocusId: (id: string) => void
  onOpenPlayingChannel: () => void
  onOpenChannelById: (id: string) => void
  onToggleFavorite: () => void
  onToggleFavoriteById?: (channelId: string) => void
  onOpenEpgPlaceholder: () => void
  /** Igual ao nexus: Enter na coluna categorias limpa a pesquisa de canais. */
  clearChannelSearch?: () => void
  /** True enquanto o fullscreen estiver activo — para ignorar tv-page-back. */
  isFullscreen?: boolean
}

export type LiveTvNavigationState = {
  focusedChannelIndex: number
  focusedCategoryIndex: number
  activePanel: LiveTvNavPanel
  channelsNavFocus: 'search' | 'list'
  onCategorySearchFocus: () => void
  onChannelSearchFocus: () => void
  focusChannelList: () => void
}

const REMOTE_REPEAT_MIN_INTERVAL_MS = 16
const HOLD_REPEAT_INITIAL_DELAY_MS = 400
const HOLD_REPEAT_INTERVAL_MS = 120
/** Tempo mínimo (ms) de pressão em Enter para activar favorito (long-press). */
const LONG_PRESS_ENTER_MS = 1200

/**
 * D-pad alinhado a `nexus-vision-prime/src/pages/LiveTV.tsx`:
 * coluna por defeito = canais; ←→ entre categorias | canais | preview;
 * no preview, ← no vídeo volta à lista; ↑ no 1.º canal → pesquisa.
 */
export function useLiveTvNavigation({
  channelSearchRef,
  categorySearchRef,
  channelSearch,
  categoryCount,
  channelCount,
  activeCatIndex,
  setActiveCatIndex,
  previewChannelId,
  setPreviewChannelId,
  visibleListToken,
  visibleChannelIds,
  setLastChannelFocusId,
  setLastCategoryFocusId,
  onOpenPlayingChannel,
  onOpenChannelById,
  onToggleFavorite,
  onToggleFavoriteById,
  onOpenEpgPlaceholder,
  clearChannelSearch,
  isFullscreen,
}: Params): LiveTvNavigationState {
  const { setFocusedId } = useTvFocus()
  const location = useLocation()
  const isLive = location.pathname === '/live'
  const renderFocusState = !isSamsungTizenLikeRuntime()

  const [activePanel, setActivePanel] = useState<LiveTvNavPanel>('channels')
  const [channelsNavFocus, setChannelsNavFocus] = useState<'search' | 'list'>('list')
  const [previewFocusIndex, setPreviewFocusIndex] = useState(PREVIEW_FOCUS_VIDEO)
  /** Índices para UI (nexus: foco D-pad ≠ categoria seleccionada até Enter). */
  const [focusedChannelIndex, setFocusedChannelIndex] = useState(0)
  const [focusedCategoryIndex, setFocusedCategoryIndex] = useState(0)

  const activePanelRef = useRef(activePanel)
  const channelsNavFocusRef = useRef(channelsNavFocus)
  const previewFocusRef = useRef(previewFocusIndex)
  const channelSearchValueRef = useRef(channelSearch)
  const activeCatIndexRef = useRef(activeCatIndex)
  const channelCountRef = useRef(channelCount)
  const categoryCountRef = useRef(categoryCount)
  const previewChannelIdRef = useRef(previewChannelId)
  const visibleChannelIdsRef = useRef(visibleChannelIds)
  const focusedChannelRef = useRef(0)
  const focusedCategoryRef = useRef(0)
  const lastRepeatHandledAtRef = useRef(0)
  const holdDirectionRef = useRef<ReturnType<typeof mapRemoteKeyToDirection>>(null)
  const holdTimeoutRef = useRef<number | null>(null)
  const holdIntervalRef = useRef<number | null>(null)
  const setActiveCatIndexRef = useRef(setActiveCatIndex)
  const setPreviewChannelIdRef = useRef(setPreviewChannelId)
  const setLastChannelFocusIdRef = useRef(setLastChannelFocusId)
  const setLastCategoryFocusIdRef = useRef(setLastCategoryFocusId)
  const onOpenPlayingChannelRef = useRef(onOpenPlayingChannel)
  const onOpenChannelByIdRef = useRef(onOpenChannelById)
  const onToggleFavoriteRef = useRef(onToggleFavorite)
  const onToggleFavoriteByIdRef = useRef(onToggleFavoriteById)
  const onOpenEpgPlaceholderRef = useRef(onOpenEpgPlaceholder)
  const clearChannelSearchRef = useRef(clearChannelSearch)
  const isFullscreenRef = useRef(!!isFullscreen)
  /** Timestamp de quando o fullscreen saiu — para ignorar tv-page-back logo após. */
  const fullscreenExitedAtRef = useRef(0)
  /** Long-press Enter: true enquanto Enter está pressionado. */
  const enterPressedRef = useRef(false)
  /** Long-press Enter: timer que dispara favorito após LONG_PRESS_ENTER_MS. */
  const enterLongTimerRef = useRef<number | null>(null)
  /** Long-press Enter: closure que executa a acção normal de Enter (short press). */
  const enterShortActionRef = useRef<(() => void) | null>(null)
  /** Long-press Enter: true se o long-press já disparou (impede short action no keyup). */
  const enterLongFiredRef = useRef(false)
  const syncFocusedCategoryForRender = useCallback((next: number) => {
    if (renderFocusState) {
      flushSync(() => {
        setFocusedCategoryIndex(next)
      })
      return
    }
    setFocusedCategoryIndex(next)
  }, [renderFocusState])
  const syncFocusedChannelForRender = useCallback((next: number) => {
    if (renderFocusState) {
      flushSync(() => {
        setFocusedChannelIndex(next)
      })
      return
    }
    setFocusedChannelIndex(next)
  }, [renderFocusState])

  /* eslint-disable react-hooks/exhaustive-deps -- key listeners intentionally stay stable while mutable navigation data flows through refs */
  useEffect(() => {
    activePanelRef.current = activePanel
  }, [activePanel])

  useEffect(() => {
    channelsNavFocusRef.current = channelsNavFocus
  }, [channelsNavFocus])

  useEffect(() => {
    previewFocusRef.current = previewFocusIndex
  }, [previewFocusIndex])

  useEffect(() => {
    activeCatIndexRef.current = activeCatIndex
  }, [activeCatIndex])

  useEffect(() => {
    channelCountRef.current = channelCount
  }, [channelCount])

  useEffect(() => {
    categoryCountRef.current = categoryCount
  }, [categoryCount])

  useEffect(() => {
    previewChannelIdRef.current = previewChannelId
  }, [previewChannelId])

  useEffect(() => {
    visibleChannelIdsRef.current = visibleChannelIds
  }, [visibleChannelIds])

  useEffect(() => {
    setActiveCatIndexRef.current = setActiveCatIndex
  }, [setActiveCatIndex])

  useEffect(() => {
    setPreviewChannelIdRef.current = setPreviewChannelId
  }, [setPreviewChannelId])

  useEffect(() => {
    setLastChannelFocusIdRef.current = setLastChannelFocusId
  }, [setLastChannelFocusId])

  useEffect(() => {
    setLastCategoryFocusIdRef.current = setLastCategoryFocusId
  }, [setLastCategoryFocusId])

  useEffect(() => {
    onOpenPlayingChannelRef.current = onOpenPlayingChannel
  }, [onOpenPlayingChannel])

  useEffect(() => {
    onOpenChannelByIdRef.current = onOpenChannelById
  }, [onOpenChannelById])

  useEffect(() => {
    onToggleFavoriteRef.current = onToggleFavorite
  }, [onToggleFavorite])

  useEffect(() => {
    onToggleFavoriteByIdRef.current = onToggleFavoriteById
  }, [onToggleFavoriteById])

  useEffect(() => {
    onOpenEpgPlaceholderRef.current = onOpenEpgPlaceholder
  }, [onOpenEpgPlaceholder])

  useEffect(() => {
    clearChannelSearchRef.current = clearChannelSearch
  }, [clearChannelSearch])

  useEffect(() => {
    const wasFullscreen = isFullscreenRef.current
    isFullscreenRef.current = !!isFullscreen
    if (wasFullscreen && !isFullscreen) {
      fullscreenExitedAtRef.current = Date.now()
    }
  }, [isFullscreen])

  useEffect(() => {
    syncFocusedCategoryForRender(activeCatIndex)
    focusedCategoryRef.current = activeCatIndex
  }, [activeCatIndex, syncFocusedCategoryForRender])

  /** Referência do último previewChannelId processado — para distinguir mudança de preview vs. mudança de lista. */
  const lastAppliedPreviewRef = useRef<string | null>(null)

  /** Lista ou preview guardado mudou: alinhar foco ao canal em preview na vista actual (ou 0). */
  useEffect(() => {
    if (!isLive || channelCount === 0) return

    const previewChanged = previewChannelId !== lastAppliedPreviewRef.current
    lastAppliedPreviewRef.current = previewChannelId

    if (previewChanged) {
      // Preview mudou (Enter na lista, restore de sessão): saltar para o canal do preview
      const idx =
        previewChannelId != null
          ? visibleChannelIds.findIndex((id) => id === previewChannelId)
          : -1
      const start = idx >= 0 ? idx : 0
      const row = Math.min(start, channelCount - 1)
      focusedChannelRef.current = row
      syncFocusedChannelForRender(row)
      if (activePanelRef.current === 'categories') return
      if (channelsNavFocusRef.current === 'search') return
      const id = `lch-${row}`
      setFocusedId(id)
      setLastChannelFocusId(id)
    } else {
      // Lista mudou por outro motivo (favorito, filtro): manter posição, apenas ajustar limites
      const clamped = Math.min(focusedChannelRef.current, channelCount - 1)
      if (clamped !== focusedChannelRef.current) {
        focusedChannelRef.current = clamped
        syncFocusedChannelForRender(clamped)
        if (activePanelRef.current !== 'categories' && channelsNavFocusRef.current !== 'search') {
          const id = `lch-${clamped}`
          setFocusedId(id)
          setLastChannelFocusId(id)
        }
      }
    }
  }, [isLive, channelCount, visibleListToken, previewChannelId, visibleChannelIds, setFocusedId, setLastChannelFocusId, syncFocusedChannelForRender])

  useEffect(() => {
    if (!isLive || channelCount === 0) return
    if (focusedChannelRef.current > channelCount - 1) {
      const next = channelCount - 1
      focusedChannelRef.current = next
      syncFocusedChannelForRender(next)
      if (activePanelRef.current === 'categories') return
      const id = `lch-${next}`
      setFocusedId(id)
      setLastChannelFocusId(id)
    }
  }, [isLive, channelCount, setFocusedId, setLastChannelFocusId, syncFocusedChannelForRender])
  useEffect(() => {
    channelSearchValueRef.current = channelSearch
  }, [channelSearch])

  useEffect(() => {
    const clearHoldRepeat = () => {
      holdDirectionRef.current = null
      if (holdTimeoutRef.current != null) {
        window.clearTimeout(holdTimeoutRef.current)
        holdTimeoutRef.current = null
      }
      if (holdIntervalRef.current != null) {
        window.clearInterval(holdIntervalRef.current)
        holdIntervalRef.current = null
      }
    }

    const handleDirectionalNavigation = (
      dir: NonNullable<ReturnType<typeof mapRemoteKeyToDirection>>,
      isHoldRepeat = false,
    ) => {
      const panel = activePanelRef.current
      const chCount = channelCountRef.current
      const catCount = categoryCountRef.current
      const keyUp = dir === 'up'
      const keyDown = dir === 'down'
      const keyLeft = dir === 'left'
      const keyRight = dir === 'right'

      if (keyLeft) {
        if (panel === 'channels') {
          flushSync(() => setActivePanel('categories'))
          const catIdx = Math.min(activeCatIndexRef.current, Math.max(0, catCount - 1))
          focusedCategoryRef.current = catIdx
          syncFocusedCategoryForRender(catIdx)
          if (catCount > 0) {
            const id = `lcat-${catIdx}`
            syncFocusTarget(id, setFocusedId)
            setLastCategoryFocusIdRef.current(id)
          } else {
            setFocusedId('hdr-profile')
          }
        } else if (panel === 'preview') {
          const z = previewFocusRef.current
          if (z === PREVIEW_FOCUS_EPG) {
            setPreviewFocusIndex(PREVIEW_FOCUS_FAVORITE)
            setFocusedId('lpv-1')
          } else if (z === PREVIEW_FOCUS_FAVORITE) {
            setPreviewFocusIndex(PREVIEW_FOCUS_VIDEO)
            setFocusedId('lpv-0')
          } else {
            setActivePanel('channels')
            setChannelsNavFocus('list')
            const pid = previewChannelIdRef.current
            if (chCount === 0) focusedChannelRef.current = 0
            else if (pid == null) focusedChannelRef.current = 0
            else {
              const idx = visibleChannelIdsRef.current.findIndex((id) => id === pid)
              focusedChannelRef.current = idx >= 0 ? idx : 0
            }
            if (chCount > 0) {
              const r = focusedChannelRef.current
              syncFocusedChannelForRender(r)
              const id = `lch-${r}`
              setFocusedId(id)
              setLastChannelFocusIdRef.current(id)
            }
          }
        }
        return true
      }

      if (keyRight) {
        if (panel === 'categories') {
          flushSync(() => setActivePanel('channels'))
          setChannelsNavFocus('list')
          const list = visibleChannelIdsRef.current
          const pid = previewChannelIdRef.current
          if (list.length === 0) focusedChannelRef.current = 0
          else if (pid == null) focusedChannelRef.current = 0
          else {
            const idx = list.findIndex((id) => id === pid)
            focusedChannelRef.current = idx >= 0 ? idx : 0
          }
          if (chCount > 0) {
            const r = Math.min(focusedChannelRef.current, chCount - 1)
            focusedChannelRef.current = r
            syncFocusedChannelForRender(r)
            const id = `lch-${r}`
            syncFocusTarget(id, setFocusedId)
            setLastChannelFocusIdRef.current(id)
          }
        } else if (panel === 'channels') {
          flushSync(() => setActivePanel('preview'))
          setPreviewFocusIndex(PREVIEW_FOCUS_VIDEO)
          syncFocusTarget('lpv-0', setFocusedId)
        } else if (panel === 'preview') {
          const z = previewFocusRef.current
          if (z === PREVIEW_FOCUS_VIDEO) {
            setPreviewFocusIndex(PREVIEW_FOCUS_FAVORITE)
            syncFocusTarget('lpv-1', setFocusedId)
          } else if (z === PREVIEW_FOCUS_FAVORITE) {
            setPreviewFocusIndex(PREVIEW_FOCUS_EPG)
            syncFocusTarget('lpv-2', setFocusedId)
          }
        }
        return true
      }

      if (keyDown) {
        if (panel === 'preview') {
          const z = previewFocusRef.current
          if (z === PREVIEW_FOCUS_VIDEO) {
            setPreviewFocusIndex(PREVIEW_FOCUS_FAVORITE)
            setFocusedId('lpv-1')
          } else if (z === PREVIEW_FOCUS_FAVORITE) {
            setPreviewFocusIndex(PREVIEW_FOCUS_EPG)
            setFocusedId('lpv-2')
          }
          return true
        }
        if (panel === 'channels' && chCount > 0) {
          setChannelsNavFocus('list')
          const nextCh = Math.min(chCount - 1, focusedChannelRef.current + 1)
          if (nextCh === focusedChannelRef.current) return true
          focusedChannelRef.current = nextCh
          syncFocusedChannelForRender(nextCh)
          const id = `lch-${nextCh}`
          setFocusedId(id)
          setLastChannelFocusIdRef.current(id)
          return true
        }
        if (panel === 'categories' && catCount > 0) {
          const nextCat = Math.min(catCount - 1, focusedCategoryRef.current + 1)
          if (nextCat === focusedCategoryRef.current) return true
          focusedCategoryRef.current = nextCat
          syncFocusedCategoryForRender(nextCat)
          const id = `lcat-${nextCat}`
          setFocusedId(id)
          setLastCategoryFocusIdRef.current(id)
          return true
        }
        return false
      }

      if (keyUp) {
        if (panel === 'preview') {
          const z = previewFocusRef.current
          if (z === PREVIEW_FOCUS_EPG) {
            setPreviewFocusIndex(PREVIEW_FOCUS_FAVORITE)
            setFocusedId('lpv-1')
          } else if (z === PREVIEW_FOCUS_FAVORITE) {
            setPreviewFocusIndex(PREVIEW_FOCUS_VIDEO)
            setFocusedId('lpv-0')
          }
          return true
        }
        if (panel === 'channels') {
          if (chCount > 0 && focusedChannelRef.current === 0) {
            if (isHoldRepeat) return true
            setChannelsNavFocus('search')
            setFocusedId('lch-search')
            window.setTimeout(() => channelSearchRef.current?.focus({ preventScroll: true }), 0)
            return true
          }
          if (chCount > 0) {
            setChannelsNavFocus('list')
            const prevCh = Math.max(0, focusedChannelRef.current - 1)
            if (prevCh === focusedChannelRef.current) return true
            focusedChannelRef.current = prevCh
            syncFocusedChannelForRender(prevCh)
            const id = `lch-${prevCh}`
            setFocusedId(id)
            setLastChannelFocusIdRef.current(id)
          } else if (!isHoldRepeat) {
            setChannelsNavFocus('search')
            setFocusedId('lch-search')
            window.setTimeout(() => channelSearchRef.current?.focus({ preventScroll: true }), 0)
          }
          return true
        }
        if (panel === 'categories' && catCount > 0) {
          if (focusedCategoryRef.current <= 0) {
            if (!isHoldRepeat) {
              if (categorySearchRef?.current) {
                setFocusedId('lcat-search')
                window.setTimeout(() => categorySearchRef.current?.focus({ preventScroll: true }), 0)
              } else {
                focusHeaderFirstControl()
              }
            }
            return true
          }
          const prevCat = Math.max(0, focusedCategoryRef.current - 1)
          focusedCategoryRef.current = prevCat
          syncFocusedCategoryForRender(prevCat)
          const id = `lcat-${prevCat}`
          setFocusedId(id)
          setLastCategoryFocusIdRef.current(id)
          return true
        }
      }

      return false
    }

    const scheduleHoldRepeat = (dir: NonNullable<ReturnType<typeof mapRemoteKeyToDirection>>) => {
      if (holdDirectionRef.current === dir) return
      clearHoldRepeat()
      holdDirectionRef.current = dir
      holdTimeoutRef.current = window.setTimeout(() => {
        handleDirectionalNavigation(dir, true)
        holdIntervalRef.current = window.setInterval(() => {
          handleDirectionalNavigation(dir, true)
        }, HOLD_REPEAT_INTERVAL_MS)
      }, HOLD_REPEAT_INITIAL_DELAY_MS)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isLive) return

      const panel = activePanelRef.current
      // Usar refs em vez de valores fechados no closure: a closure é criada quando
      // isLive se torna true (antes do catálogo carregar), pelo que channelCount e
      // categoryCount seriam 0. Os refs são actualizados por useEffect separados.
      const chCount = channelCountRef.current
      const catCount = categoryCountRef.current
      const ae = document.activeElement
      const inHeader = ae instanceof HTMLElement && Boolean(ae.closest('header'))

      const dir = mapRemoteKeyToDirection(e)
      const keyUp = dir === 'up'
      const keyDown = dir === 'down'
      const keyLeft = dir === 'left'

      if (dir && e.repeat) {
        const now = performance.now()
        if (now - lastRepeatHandledAtRef.current < REMOTE_REPEAT_MIN_INTERVAL_MS) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        lastRepeatHandledAtRef.current = now
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (inHeader && keyDown) {
        e.preventDefault()
        e.stopPropagation()
        setActivePanel('categories')
        setChannelsNavFocus('list')
        const catIdx = Math.min(activeCatIndexRef.current, Math.max(0, categoryCountRef.current - 1))
        focusedCategoryRef.current = catIdx
        syncFocusedCategoryForRender(catIdx)
        window.setTimeout(() => {
          if (categoryCountRef.current > 0) {
            const id = `lcat-${catIdx}`
            focusElementByFocusId(id)
            setFocusedId(id)
            setLastCategoryFocusIdRef.current(id)
          }
        }, 0)
        return
      }

      if (
        keyDown &&
        panel === 'categories' &&
        document.activeElement === categorySearchRef?.current
      ) {
        e.preventDefault()
        e.stopPropagation()
        const catCount = categoryCountRef.current
        if (catCount > 0) {
          focusedCategoryRef.current = 0
          syncFocusedCategoryForRender(0)
          const id = 'lcat-0'
          setFocusedId(id)
          setLastCategoryFocusIdRef.current(id)
          window.setTimeout(() => {
            categorySearchRef?.current?.blur()
            focusElementByFocusId(id)
          }, 0)
        }
        return
      }

      if (
        keyDown &&
        panel === 'channels' &&
        document.activeElement === channelSearchRef.current
      ) {
        e.preventDefault()
        e.stopPropagation()
        setChannelsNavFocus('list')
        channelSearchRef.current?.blur()
        if (chCount > 0) {
          const r = Math.min(chCount - 1, Math.max(0, focusedChannelRef.current))
          focusedChannelRef.current = r
          syncFocusedChannelForRender(r)
          const id = `lch-${r}`
          setFocusedId(id)
          setLastChannelFocusIdRef.current(id)
        }
        return
      }

      if (
        keyLeft &&
        panel === 'channels' &&
        document.activeElement === channelSearchRef.current &&
        channelSearchValueRef.current.trim() === ''
      ) {
        e.preventDefault()
        e.stopPropagation()
        setChannelsNavFocus('list')
        channelSearchRef.current?.blur()
        setActivePanel('categories')
        const catIdx = Math.min(activeCatIndexRef.current, Math.max(0, categoryCountRef.current - 1))
        focusedCategoryRef.current = catIdx
        syncFocusedCategoryForRender(catIdx)
        if (categoryCountRef.current > 0) {
          const id = `lcat-${catIdx}`
          setFocusedId(id)
          setLastCategoryFocusIdRef.current(id)
        } else {
          setFocusedId('hdr-profile')
        }
        return
      }

      if (keyUp) {
        if (document.activeElement === categorySearchRef?.current) {
          e.preventDefault()
          e.stopPropagation()
          setFocusedId('hdr-profile')
          categorySearchRef?.current?.blur()
          window.setTimeout(() => focusElementByFocusId('hdr-profile'), 0)
          return
        }
        if (document.activeElement === channelSearchRef.current) {
          e.preventDefault()
          e.stopPropagation()
          setFocusedId('hdr-profile')
          channelSearchRef.current?.blur()
          window.setTimeout(() => focusElementByFocusId('hdr-profile'), 0)
          return
        }
      }

      const isFormField =
        ae instanceof HTMLInputElement ||
        ae instanceof HTMLTextAreaElement ||
        ae instanceof HTMLSelectElement
      if (isFormField) {
        if (!isSamsungTizenLikeRuntime()) return
        if (!dir && !isRemoteBackKey(e)) return
      } else if (isTypingTarget(e.target)) {
        return
      }

      if (isRemoteBackKey(e)) {
        // preview → canais → categorias → deixar passar (Home)
        if (panel === 'preview') {
          e.preventDefault()
          e.stopImmediatePropagation()
          setActivePanel('channels')
          setChannelsNavFocus('list')
          const idx = Math.min(focusedChannelRef.current, Math.max(0, chCount - 1))
          focusedChannelRef.current = idx
          syncFocusedChannelForRender(idx)
          const id = `lch-${idx}`
          setFocusedId(id)
          setLastChannelFocusIdRef.current(id)
          return
        }
        if (panel === 'channels') {
          e.preventDefault()
          e.stopImmediatePropagation()
          setActivePanel('categories')
          setChannelsNavFocus('list')
          const catIdx = Math.min(activeCatIndexRef.current, Math.max(0, catCount - 1))
          focusedCategoryRef.current = catIdx
          syncFocusedCategoryForRender(catIdx)
          if (catCount > 0) {
            const id = `lcat-${catIdx}`
            setFocusedId(id)
            setLastCategoryFocusIdRef.current(id)
          }
          return
        }
        // panel === 'categories': deixar passar para o TvFocusProvider → onBack → Home
        return
      }

      if (isRemoteYellowKey(e)) {
        e.preventDefault()
        e.stopPropagation()
        if (panel === 'channels' && chCount > 0) {
          const chId = visibleChannelIdsRef.current[focusedChannelRef.current]
          if (chId) {
            onToggleFavoriteByIdRef.current?.(chId)
            return
          }
        }
        onToggleFavoriteRef.current()
        return
      }

      if (dir) {
        e.preventDefault()
        e.stopPropagation()
        handleDirectionalNavigation(dir, false)
        scheduleHoldRepeat(dir)
        return
      }

      if (isRemoteEnterKey(e)) {
        // Long-press Enter: no keydown, agenda timer de 2s para favoritar.
        // Se soltar antes dos 2s (keyup), cancela o timer e executa acção normal.
        // Se o timer disparar (2s), favorita imediatamente sem esperar keyup.
        if (e.repeat) {
          e.preventDefault()
          e.stopPropagation()
          return
        }

        e.preventDefault()
        e.stopPropagation()

        // Limpar timer anterior (safety)
        if (enterLongTimerRef.current != null) {
          window.clearTimeout(enterLongTimerRef.current)
          enterLongTimerRef.current = null
        }
        enterPressedRef.current = true
        enterLongFiredRef.current = false

        // Determinar acção de long-press (favorito) para o contexto actual
        const longPressAction = (): void => {
          if (panel === 'channels' && chCount > 0) {
            const chId = visibleChannelIdsRef.current[focusedChannelRef.current]
            if (chId) onToggleFavoriteByIdRef.current?.(chId)
          } else if (panel === 'preview') {
            onToggleFavoriteRef.current()
          }
        }

        // Agendar long-press: dispara após LONG_PRESS_ENTER_MS
        enterLongTimerRef.current = window.setTimeout(() => {
          enterLongTimerRef.current = null
          enterLongFiredRef.current = true
          enterShortActionRef.current = null
          longPressAction()
        }, LONG_PRESS_ENTER_MS)

        // Capturar a acção normal como closure para executar no keyup (short press)
        const focusedId = tvFocusIdStore.get()
        if (focusedId?.startsWith('lcat-') && catCount > 0) {
          const parsed = Number(focusedId.slice(5))
          const nextCat = Number.isFinite(parsed) ? parsed : focusedCategoryRef.current
          const clampedCat = Math.max(0, Math.min(nextCat, Math.max(0, catCount - 1)))
          enterShortActionRef.current = () => {
            focusedCategoryRef.current = clampedCat
            clearChannelSearchRef.current?.()
            flushSync(() => setActivePanel('channels'))
            setChannelsNavFocus('list')
            setActiveCatIndexRef.current(clampedCat)
          }
          return
        }

        if (focusedId?.startsWith('lch-') && chCount > 0) {
          const parsed = Number(focusedId.slice(4))
          const nextChannel = Number.isFinite(parsed) ? parsed : focusedChannelRef.current
          const clampedCh = Math.max(0, Math.min(nextChannel, Math.max(0, chCount - 1)))
          const chId = visibleChannelIdsRef.current[clampedCh]
          enterShortActionRef.current = chId ? () => {
            focusedChannelRef.current = clampedCh
            if (chId !== previewChannelIdRef.current) {
              previewChannelIdRef.current = chId
              setPreviewChannelIdRef.current(chId)
            } else {
              onOpenChannelByIdRef.current(chId)
            }
          } : null
          return
        }

        if (focusedId?.startsWith('lpv-') && chCount > 0) {
          const z = Number(focusedId.slice(4))
          enterShortActionRef.current = () => {
            if (z === PREVIEW_FOCUS_VIDEO) onOpenPlayingChannelRef.current()
            else if (z === PREVIEW_FOCUS_FAVORITE) onToggleFavoriteRef.current()
            else if (z === PREVIEW_FOCUS_EPG) onOpenEpgPlaceholderRef.current()
          }
          return
        }

        if (panel === 'preview' && chCount > 0) {
          if (activateCurrentTvTarget(document.activeElement)) {
            enterPressedRef.current = false
            if (enterLongTimerRef.current != null) { window.clearTimeout(enterLongTimerRef.current); enterLongTimerRef.current = null }
            enterShortActionRef.current = null
            return
          }
          const z = previewFocusRef.current
          enterShortActionRef.current = () => {
            if (z === PREVIEW_FOCUS_VIDEO) onOpenPlayingChannelRef.current()
            else if (z === PREVIEW_FOCUS_FAVORITE) onToggleFavoriteRef.current()
            else if (z === PREVIEW_FOCUS_EPG) onOpenEpgPlaceholderRef.current()
          }
          return
        }

        if (panel === 'categories' && catCount > 0) {
          if (activateCurrentTvTarget(document.activeElement)) {
            enterPressedRef.current = false
            if (enterLongTimerRef.current != null) { window.clearTimeout(enterLongTimerRef.current); enterLongTimerRef.current = null }
            enterShortActionRef.current = null
            return
          }
          enterShortActionRef.current = () => {
            clearChannelSearchRef.current?.()
            flushSync(() => setActivePanel('channels'))
            setChannelsNavFocus('list')
            setActiveCatIndexRef.current(focusedCategoryRef.current)
          }
          return
        }
        if (panel === 'channels' && chCount > 0) {
          const ch = visibleChannelIdsRef.current[focusedChannelRef.current]
          enterShortActionRef.current = ch ? () => {
            if (ch !== previewChannelIdRef.current) {
              previewChannelIdRef.current = ch
              setPreviewChannelIdRef.current(ch)
            } else {
              onOpenChannelByIdRef.current(ch)
            }
          } : null
          return
        }

        // Nenhuma acção identificada — cancelar timer
        enterPressedRef.current = false
        if (enterLongTimerRef.current != null) { window.clearTimeout(enterLongTimerRef.current); enterLongTimerRef.current = null }
        enterShortActionRef.current = null
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    const clearEnterLongPress = () => {
      enterPressedRef.current = false
      if (enterLongTimerRef.current != null) {
        window.clearTimeout(enterLongTimerRef.current)
        enterLongTimerRef.current = null
      }
      enterShortActionRef.current = null
      enterLongFiredRef.current = false
    }

    const onKeyUp = (e: KeyboardEvent) => {
      // Long-press Enter: se soltar antes de 2s → acção normal; se já disparou → ignorar
      if (isRemoteEnterKey(e) && enterPressedRef.current) {
        const alreadyFired = enterLongFiredRef.current
        const shortAction = enterShortActionRef.current
        clearEnterLongPress()
        if (!alreadyFired) {
          // Short press → executar acção normal
          shortAction?.()
        }
        return
      }
      const dir = mapRemoteKeyToDirection(e)
      if (!dir) return
      if (holdDirectionRef.current === dir) clearHoldRepeat()
    }
    const onWindowBlur = () => {
      clearHoldRepeat()
      clearEnterLongPress()
    }
    // Back via postMessage/tizenhwkey: TvFocusProvider dispara tv-page-back (cancelable)
    // preview → canais → categorias → deixar passar (Home)
    const onPageBack = (ev: Event) => {
      if (!isLive) return
      // Ignorar tv-page-back logo após sair do fullscreen (< 500ms) — evita que um
      // segundo evento Back (keydown após tizenhwkey) mova de channels → categories.
      if (isFullscreenRef.current || Date.now() - fullscreenExitedAtRef.current < 500) {
        ev.preventDefault()
        return
      }
      const panel = activePanelRef.current
      const chCount = channelCountRef.current
      const catCount = categoryCountRef.current
      if (panel === 'preview') {
        ev.preventDefault()
        setActivePanel('channels')
        setChannelsNavFocus('list')
        const idx = Math.min(focusedChannelRef.current, Math.max(0, chCount - 1))
        focusedChannelRef.current = idx
        syncFocusedChannelForRender(idx)
        const id = `lch-${idx}`
        setFocusedId(id)
        setLastChannelFocusIdRef.current(id)
        return
      }
      if (panel === 'channels') {
        ev.preventDefault()
        setActivePanel('categories')
        setChannelsNavFocus('list')
        const catIdx = Math.min(activeCatIndexRef.current, Math.max(0, catCount - 1))
        focusedCategoryRef.current = catIdx
        syncFocusedCategoryForRender(catIdx)
        if (catCount > 0) {
          const id = `lcat-${catIdx}`
          setFocusedId(id)
          setLastCategoryFocusIdRef.current(id)
        }
        return
      }
      // panel === 'categories': não prevenir → TvFocusProvider chama onBack → Home
    }

    window.addEventListener('tv-page-back', onPageBack)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onWindowBlur)
    document.addEventListener('visibilitychange', onWindowBlur)
    return () => {
      clearHoldRepeat()
      window.removeEventListener('tv-page-back', onPageBack)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onWindowBlur)
      document.removeEventListener('visibilitychange', onWindowBlur)
    }
  }, [isLive, channelSearchRef, setFocusedId, categorySearchRef, syncFocusedCategoryForRender, syncFocusedChannelForRender])
  /* eslint-enable react-hooks/exhaustive-deps */

  const onCategorySearchFocus = useCallback(() => {
    setActivePanel('categories')
  }, [])

  const onChannelSearchFocus = useCallback(() => {
    setActivePanel('channels')
    setChannelsNavFocus('search')
  }, [])

  /** Força o foco de volta à lista de canais (ex: ao sair do fullscreen). */
  const focusChannelList = useCallback(() => {
    setActivePanel('channels')
    setChannelsNavFocus('list')
    const idx = focusedChannelRef.current
    const id = `lch-${idx}`
    setFocusedId(id)
    setLastChannelFocusIdRef.current(id)
  }, [setFocusedId])

  return {
    focusedChannelIndex,
    focusedCategoryIndex,
    activePanel,
    channelsNavFocus,
    onCategorySearchFocus,
    onChannelSearchFocus,
    focusChannelList,
  }
}

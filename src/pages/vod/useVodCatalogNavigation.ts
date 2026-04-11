import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { APP_HDR, useTvFocus } from '@/lib/tvFocus'
import { tvFocusIdStore } from '@/lib/tvFocus/tvFocusIdStore'
import { isRemoteBackKey, isRemoteEnterKey, isRemoteYellowKey, isSamsungTizenLikeRuntime, mapRemoteKeyToDirection } from '@/lib/tvFocus/tvRemoteKeys'

export type VodCatalogPanel = 'categories' | 'grid'
const REMOTE_REPEAT_MIN_INTERVAL_MS = 16
const HOLD_REPEAT_INITIAL_DELAY_MS = 170
const HOLD_REPEAT_INTERVAL_MS = 34
/** Tempo mínimo (ms) de pressão em Enter para activar favorito (long-press). */
const LONG_PRESS_ENTER_MS = 1200

function focusElementByFocusId(id: string): void {
  const el = document.getElementById(`focus-${id}`)
  if (el instanceof HTMLElement) el.focus({ preventScroll: true })
}

/** ↑ das duas search bars → ícone à direita do header (com `buildVodCatalogShellPlan`, ↓ volta à search da grelha). */
const HDR_RIGHT_FOCUS_ID = APP_HDR.power

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable
}

function keyEventFocusInside(shell: Element | null, e: KeyboardEvent): boolean {
  if (!shell) return false
  const ae = document.activeElement
  if (ae instanceof Node && shell.contains(ae)) return true
  if (e.target instanceof Node && shell.contains(e.target as Node)) return true
  // Fallback: após fechar modal Radix, activeElement fica em <body> e e.target também.
  // O tvFocusIdStore sabe qual elemento deveria ter foco — verificar se está dentro do shell.
  const storeId = tvFocusIdStore.get()
  if (storeId) {
    const storeEl = document.getElementById(`focus-${storeId}`)
    if (storeEl instanceof HTMLElement && shell.contains(storeEl)) return true
  }
  return false
}

function idCat(prefix: string, i: number): string {
  return `${prefix}-cat-${i}`
}

function idMv(prefix: string, i: number): string {
  return `${prefix}-mv-${i}`
}

function isFocusOnCategorySearch(
  ae: EventTarget | null,
  categorySearchRef: RefObject<HTMLInputElement | null>,
  catSearchId: string,
): boolean {
  if (!(ae instanceof HTMLElement)) return false
  const wrap = document.getElementById(`focus-${catSearchId}`)
  if (wrap?.contains(ae)) return true
  const input = categorySearchRef.current
  if (input && (ae === input || input.contains(ae))) return true
  return false
}

function isFocusOnGridSearch(
  ae: EventTarget | null,
  gridSearchRef: RefObject<HTMLInputElement | null>,
  gridSearchId: string,
): boolean {
  if (!(ae instanceof HTMLElement)) return false
  const wrap = document.getElementById(`focus-${gridSearchId}`)
  if (wrap?.contains(ae)) return true
  const input = gridSearchRef.current
  if (input && (ae === input || input.contains(ae))) return true
  return false
}

export type UseVodCatalogNavigationArgs = {
  routePath: '/movies' | '/series'
  /** Prefixo dos ids de foco, ex.: `movies` ou `series`. */
  idPrefix: string
  categorySearchRef: RefObject<HTMLInputElement | null>
  gridSearchRef: RefObject<HTMLInputElement | null>
  filteredCategoryCount: number
  itemCount: number
  gridColumns: number
  getRealCategoryIndex: (filteredIndex: number) => number
  onCategoryActivate: (realIndex: number) => void
  onItemActivate: (flatIndex: number) => void
  onToggleFavorite?: () => void
}

export type UseVodCatalogNavigationResult = {
  focusedCategoryIndex: number
  focusedItemIndex: number
  activePanel: VodCatalogPanel
  onCategorySearchFocus: () => void
  onGridSearchFocus: () => void
  onCategoryRowBecameFocused: () => void
  onGridItemBecameFocused: () => void
  /** Primeiro foco útil para `buildVodCatalogShellPlan` / `buildLiveTvShellOnlyPlan`. */
  shellMainFocusId: string
}

/**
 * D-pad para páginas VOD (Movies / Series), alinhado a `useLiveTvNavigation`:
 * o `TvFocusProvider` ignora setas dentro de `data-iptv-vod-main` / `data-iptv-series-main`;
 * este hook trata navegação espacial e Enter.
 */
export function useVodCatalogNavigation({
  routePath,
  idPrefix,
  categorySearchRef,
  gridSearchRef,
  filteredCategoryCount,
  itemCount,
  gridColumns,
  getRealCategoryIndex,
  onCategoryActivate,
  onItemActivate,
  onToggleFavorite,
}: UseVodCatalogNavigationArgs): UseVodCatalogNavigationResult {
  const { setFocusedId } = useTvFocus()
  const location = useLocation()
  const isRoute = location.pathname === routePath
  const renderFocusState = !isSamsungTizenLikeRuntime()

  const onCategoryActivateRef = useRef(onCategoryActivate)
  const onItemActivateRef = useRef(onItemActivate)
  const onToggleFavoriteRef = useRef(onToggleFavorite)
  const getRealCategoryIndexRef = useRef(getRealCategoryIndex)
  const filteredCategoryCountRef = useRef(filteredCategoryCount)
  const itemCountRef = useRef(itemCount)
  const gridColumnsRef = useRef(gridColumns)

  const [activePanel, setActivePanel] = useState<VodCatalogPanel>('categories')
  const [focusedCategoryIndex, setFocusedCategoryIndex] = useState(0)
  const [focusedItemIndex, setFocusedItemIndex] = useState(0)

  const activePanelRef = useRef(activePanel)
  const focusedCategoryRef = useRef(0)
  const focusedItemRef = useRef(0)
  const lastRepeatHandledAtRef = useRef(0)
  /** Long-press Enter: true enquanto Enter está pressionado. */
  const enterPressedRef = useRef(false)
  /** Long-press Enter: timer que dispara favorito após LONG_PRESS_ENTER_MS. */
  const enterLongTimerRef = useRef<number | null>(null)
  /** Long-press Enter: closure que executa a acção normal de Enter (short press). */
  const enterShortActionRef = useRef<(() => void) | null>(null)
  /** Long-press Enter: true se o long-press já disparou. */
  const enterLongFiredRef = useRef(false)
  const holdDirectionRef = useRef<ReturnType<typeof mapRemoteKeyToDirection>>(null)
  const holdTimeoutRef = useRef<number | null>(null)
  const holdIntervalRef = useRef<number | null>(null)
  const syncFocusedCategoryIndex = useCallback((next: number) => {
    if (renderFocusState) {
      flushSync(() => {
        setFocusedCategoryIndex(next)
      })
      return
    }
    setFocusedCategoryIndex(next)
  }, [renderFocusState])
  const syncFocusedItemIndex = useCallback((next: number) => {
    if (renderFocusState) {
      flushSync(() => {
        setFocusedItemIndex(next)
      })
      return
    }
    setFocusedItemIndex(next)
  }, [renderFocusState])

  useEffect(() => {
    onCategoryActivateRef.current = onCategoryActivate
  }, [onCategoryActivate])

  useEffect(() => {
    onItemActivateRef.current = onItemActivate
  }, [onItemActivate])

  useEffect(() => {
    onToggleFavoriteRef.current = onToggleFavorite
  }, [onToggleFavorite])

  useEffect(() => {
    getRealCategoryIndexRef.current = getRealCategoryIndex
  }, [getRealCategoryIndex])

  useEffect(() => {
    filteredCategoryCountRef.current = filteredCategoryCount
  }, [filteredCategoryCount])

  useEffect(() => {
    itemCountRef.current = itemCount
  }, [itemCount])

  useEffect(() => {
    gridColumnsRef.current = gridColumns
  }, [gridColumns])

  useEffect(() => {
    activePanelRef.current = activePanel
  }, [activePanel])

  useEffect(() => {
    focusedCategoryRef.current = focusedCategoryIndex
  }, [focusedCategoryIndex])

  useEffect(() => {
    focusedItemRef.current = focusedItemIndex
  }, [focusedItemIndex])

  const catSearchId = `${idPrefix}-cat-search`
  const gridSearchId = `${idPrefix}-grid-search`

  const shellMainFocusId =
    filteredCategoryCount > 0 ? idCat(idPrefix, 0) : itemCount > 0 ? idMv(idPrefix, 0) : catSearchId

  /* eslint-disable react-hooks/set-state-in-effect -- VOD navigation keeps render indices aligned with active category/grid bounds */
  useEffect(() => {
    if (!isRoute) return
    if (focusedCategoryRef.current >= filteredCategoryCount) {
      const next = Math.max(0, filteredCategoryCount - 1)
      focusedCategoryRef.current = next
      syncFocusedCategoryIndex(next)
    }
  }, [isRoute, filteredCategoryCount, syncFocusedCategoryIndex])

  useEffect(() => {
    if (!isRoute) return
    if (itemCount === 0) return
    if (focusedItemRef.current > itemCount - 1) {
      const next = itemCount - 1
      focusedItemRef.current = next
      syncFocusedItemIndex(next)
      setFocusedId(idMv(idPrefix, next))
    }
  }, [isRoute, itemCount, idPrefix, setFocusedId, syncFocusedItemIndex])
  /* eslint-enable react-hooks/set-state-in-effect */
  const onCategorySearchFocus = useCallback(() => {
    setActivePanel('categories')
  }, [])

  const onGridSearchFocus = useCallback(() => {
    setActivePanel('grid')
  }, [])

  const onCategoryRowBecameFocused = useCallback(() => {
    setActivePanel('categories')
  }, [])

  const onGridItemBecameFocused = useCallback(() => {
    setActivePanel('grid')
  }, [])

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
      const fc = filteredCategoryCountRef.current
      const ic = itemCountRef.current
      const C = Math.max(1, gridColumnsRef.current)
      const keyUp = dir === 'up'
      const keyDown = dir === 'down'
      const keyLeft = dir === 'left'
      const keyRight = dir === 'right'

      if (keyRight && panel === 'categories' && fc > 0 && ic > 0) {
        setActivePanel('grid')
        const ii = Math.min(focusedItemRef.current, ic - 1)
        focusedItemRef.current = ii
        syncFocusedItemIndex(ii)
        setFocusedId(idMv(idPrefix, ii))
        return true
      }

      if (keyLeft && panel === 'grid' && ic > 0) {
        const ii = focusedItemRef.current
        const col = ii % C
        if (col > 0) {
          const next = ii - 1
          focusedItemRef.current = next
          syncFocusedItemIndex(next)
          setFocusedId(idMv(idPrefix, next))
          return true
        }
        setActivePanel('categories')
        const ci = Math.min(focusedCategoryRef.current, fc - 1)
        focusedCategoryRef.current = Math.max(0, ci)
        syncFocusedCategoryIndex(focusedCategoryRef.current)
        setFocusedId(idCat(idPrefix, focusedCategoryRef.current))
        return true
      }

      if (panel === 'categories' && fc > 0) {
        const i = focusedCategoryRef.current
        if (keyDown) {
          const next = Math.min(fc - 1, i + 1)
          if (next === i) return true
          focusedCategoryRef.current = next
          syncFocusedCategoryIndex(next)
          setFocusedId(idCat(idPrefix, next))
          return true
        }
        if (keyUp) {
          if (i <= 0) {
            if (!isHoldRepeat) {
              setFocusedId(catSearchId)
              window.setTimeout(() => categorySearchRef.current?.focus({ preventScroll: true }), 0)
            }
            return true
          }
          const next = i - 1
          focusedCategoryRef.current = next
          syncFocusedCategoryIndex(next)
          setFocusedId(idCat(idPrefix, next))
          return true
        }
        return false
      }

      if (panel === 'grid' && ic > 0) {
        const i = Math.min(focusedItemRef.current, ic - 1)
        const row = Math.floor(i / C)

        if (keyUp) {
          if (row <= 0) {
            if (!isHoldRepeat) {
              setActivePanel('grid')
              setFocusedId(gridSearchId)
              window.setTimeout(() => gridSearchRef.current?.focus({ preventScroll: true }), 0)
            }
            return true
          }
          const next = i - C
          focusedItemRef.current = next
          syncFocusedItemIndex(next)
          setFocusedId(idMv(idPrefix, next))
          return true
        }

        if (keyDown) {
          const next = i + C
          if (next < ic) {
            focusedItemRef.current = next
            syncFocusedItemIndex(next)
            setFocusedId(idMv(idPrefix, next))
          }
          return true
        }

        if (keyRight) {
          const lastInRow = Math.min(ic - 1, (row + 1) * C - 1)
          if (i < lastInRow) {
            const next = i + 1
            focusedItemRef.current = next
            syncFocusedItemIndex(next)
            setFocusedId(idMv(idPrefix, next))
          }
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
      if (!isRoute) return
      if (document.querySelector('[data-tv-modal-open="1"]')) return

      const vodMain = document.querySelector('[data-iptv-vod-main="1"]')
      const seriesMain = document.querySelector('[data-iptv-series-main="1"]')
      const inVodShell =
        (routePath === '/movies' && keyEventFocusInside(vodMain, e)) ||
        (routePath === '/series' && keyEventFocusInside(seriesMain, e))
      if (!inVodShell) return

      const ae = document.activeElement
      const dir = mapRemoteKeyToDirection(e)
      const keyUp = dir === 'up'
      const keyDown = dir === 'down'
      const keyLeft = dir === 'left'
      const keyRight = dir === 'right'

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

      const fc = filteredCategoryCountRef.current
      const ic = itemCountRef.current

      const isFormField =
        ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement || ae instanceof HTMLSelectElement
      if (isFormField) {
        /** No browser, setas/back devem chegar aqui (nexus: search não “mata” só ↓). */
        const allowNavKeys = Boolean(dir) || isRemoteBackKey(e)
        if (!allowNavKeys) return
      } else if (isTypingTarget(ae) || isTypingTarget(e.target)) {
        return
      }

      if (isRemoteBackKey(e)) return

      if (isRemoteYellowKey(e)) {
        e.preventDefault()
        e.stopPropagation()
        onToggleFavoriteRef.current?.()
        return
      }

      if (isRemoteEnterKey(e)) {
        if (
          isFocusOnCategorySearch(ae, categorySearchRef, catSearchId) ||
          isFocusOnGridSearch(ae, gridSearchRef, gridSearchId)
        ) {
          return
        }
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

        // Agendar long-press: dispara favorito após LONG_PRESS_ENTER_MS
        enterLongTimerRef.current = window.setTimeout(() => {
          enterLongTimerRef.current = null
          enterLongFiredRef.current = true
          enterShortActionRef.current = null
          onToggleFavoriteRef.current?.()
        }, LONG_PRESS_ENTER_MS)

        if (activePanelRef.current === 'categories' && fc > 0) {
          const fi = focusedCategoryRef.current
          enterShortActionRef.current = (fi >= 0 && fi < fc)
            ? () => onCategoryActivateRef.current(getRealCategoryIndexRef.current(fi))
            : null
        } else if (activePanelRef.current === 'grid' && ic > 0) {
          const ii = Math.min(focusedItemRef.current, ic - 1)
          enterShortActionRef.current = () => onItemActivateRef.current(ii)
        } else {
          enterPressedRef.current = false
          if (enterLongTimerRef.current != null) { window.clearTimeout(enterLongTimerRef.current); enterLongTimerRef.current = null }
          enterShortActionRef.current = null
        }
        return
      }

      if (keyUp) {
        if (isFocusOnCategorySearch(ae, categorySearchRef, catSearchId)) {
          e.preventDefault()
          e.stopPropagation()
          setFocusedId(HDR_RIGHT_FOCUS_ID)
          return
        }
        if (isFocusOnGridSearch(ae, gridSearchRef, gridSearchId)) {
          e.preventDefault()
          e.stopPropagation()
          setFocusedId(HDR_RIGHT_FOCUS_ID)
          return
        }
      }

      if (keyDown && isFocusOnCategorySearch(ae, categorySearchRef, catSearchId)) {
        e.preventDefault()
        e.stopPropagation()
        if (fc > 0) {
          focusedCategoryRef.current = 0
          syncFocusedCategoryIndex(0)
          const id = idCat(idPrefix, 0)
          setFocusedId(id)
          categorySearchRef.current?.blur()
          window.setTimeout(() => focusElementByFocusId(id), 0)
        } else if (ic > 0) {
          setActivePanel('grid')
          focusedItemRef.current = 0
          syncFocusedItemIndex(0)
          const gid = idMv(idPrefix, 0)
          setFocusedId(gid)
          categorySearchRef.current?.blur()
          window.setTimeout(() => focusElementByFocusId(gid), 0)
        }
        return
      }

      if (keyDown && isFocusOnGridSearch(ae, gridSearchRef, gridSearchId)) {
        e.preventDefault()
        e.stopPropagation()
        if (ic > 0) {
          setActivePanel('grid')
          focusedItemRef.current = 0
          syncFocusedItemIndex(0)
          const id = idMv(idPrefix, 0)
          setFocusedId(id)
          gridSearchRef.current?.blur()
          const wrap = document.getElementById(`focus-${gridSearchId}`)
          if (wrap instanceof HTMLElement) wrap.blur()
          window.setTimeout(() => focusElementByFocusId(id), 0)
        } else if (fc > 0) {
          setActivePanel('categories')
          focusedCategoryRef.current = 0
          syncFocusedCategoryIndex(0)
          const id = idCat(idPrefix, 0)
          setFocusedId(id)
          gridSearchRef.current?.blur()
          const wrap = document.getElementById(`focus-${gridSearchId}`)
          if (wrap instanceof HTMLElement) wrap.blur()
          window.setTimeout(() => focusElementByFocusId(id), 0)
        }
        return
      }

      if (keyLeft && isFocusOnGridSearch(ae, gridSearchRef, gridSearchId)) {
        e.preventDefault()
        e.stopPropagation()
        setActivePanel('categories')
        setFocusedId(catSearchId)
        gridSearchRef.current?.blur()
        window.setTimeout(() => {
          categorySearchRef.current?.focus({ preventScroll: true })
        }, 0)
        return
      }

      if (keyRight && isFocusOnCategorySearch(ae, categorySearchRef, catSearchId)) {
        e.preventDefault()
        e.stopPropagation()
        setActivePanel('grid')
        setFocusedId(gridSearchId)
        categorySearchRef.current?.blur()
        window.setTimeout(() => {
          gridSearchRef.current?.focus({ preventScroll: true })
        }, 0)
        return
      }

      if (!dir) return

      e.preventDefault()
      e.stopPropagation()

      handleDirectionalNavigation(dir, false)
      scheduleHoldRepeat(dir)
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
      if (isRemoteEnterKey(e) && enterPressedRef.current) {
        const alreadyFired = enterLongFiredRef.current
        const shortAction = enterShortActionRef.current
        clearEnterLongPress()
        if (!alreadyFired) {
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
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onWindowBlur)
    document.addEventListener('visibilitychange', onWindowBlur)
    return () => {
      clearHoldRepeat()
      clearEnterLongPress()
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onWindowBlur)
      document.removeEventListener('visibilitychange', onWindowBlur)
    }
  }, [
    isRoute,
    routePath,
    idPrefix,
    categorySearchRef,
    gridSearchRef,
    catSearchId,
    gridSearchId,
    setFocusedId,
    syncFocusedCategoryIndex,
    syncFocusedItemIndex,
  ])

  return {
    focusedCategoryIndex,
    focusedItemIndex,
    activePanel,
    onCategorySearchFocus,
    onGridSearchFocus,
    onCategoryRowBecameFocused,
    onGridItemBecameFocused,
    shellMainFocusId,
  }
}

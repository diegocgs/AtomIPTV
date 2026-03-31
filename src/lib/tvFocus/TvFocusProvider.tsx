import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ElementRef } from './context'
import { TvFocusContext } from './context'
import type { TvFocusPlan } from './types'
import {
  isRemoteBackKey,
  isRemoteEnterKey,
  isSamsungTizenLikeRuntime,
  mapRemoteKeyToDirection,
} from './tvRemoteKeys'

export function TvFocusProvider({
  children,
  onBack,
}: {
  children: ReactNode
  onBack?: () => void
}) {
  const [focusedId, setFocusedIdState] = useState<string | null>(null)
  const elementsRef = useRef<Map<string, ElementRef>>(new Map())
  const planRef = useRef<TvFocusPlan | null>(null)

  const register = useCallback((id: string, el: ElementRef) => {
    const m = elementsRef.current
    if (el) m.set(id, el)
    else m.delete(id)
  }, [])

  const unregister = useCallback((id: string) => {
    elementsRef.current.delete(id)
  }, [])

  const mountPlan = useCallback((plan: TvFocusPlan) => {
    planRef.current = plan
    setFocusedIdState((prev) => {
      if (prev && plan.neighbors[prev]) return prev
      return plan.defaultFocusId
    })
  }, [])

  const unmountPlan = useCallback(() => {
    planRef.current = null
    setFocusedIdState(null)
  }, [])

  const setFocusedId = useCallback((id: string | null) => {
    setFocusedIdState(id)
  }, [])

  const isFocused = useCallback(
    (id: string) => focusedId === id,
    [focusedId],
  )

  useEffect(() => {
    if (document.querySelector('[data-tv-add-pl-dialog="1"]')) return
    if (!focusedId) return
    const el = elementsRef.current.get(focusedId)
    el?.focus({ preventScroll: true })
    const scrollBehavior: ScrollBehavior = isSamsungTizenLikeRuntime() ? 'auto' : 'smooth'
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: scrollBehavior })
  }, [focusedId])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof HTMLElement && target.isContentEditable) {
        return
      }

      const isFormField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement

      if (isFormField) {
        if (!isSamsungTizenLikeRuntime()) {
          return
        }
        const dir = mapRemoteKeyToDirection(e)
        if (!dir && !isRemoteBackKey(e)) {
          return
        }
      }

      const dirEarly = mapRemoteKeyToDirection(e)
      if (e.defaultPrevented && (dirEarly || isRemoteEnterKey(e))) {
        return
      }

      const livePage = document.querySelector('[data-live-tv-page="1"]')
      if (livePage) {
        if (
          e.target instanceof Node &&
          livePage.contains(e.target) &&
          (dirEarly || isRemoteEnterKey(e))
        ) {
          return
        }
        if (
          e.target instanceof HTMLElement &&
          e.target.closest('header') &&
          dirEarly === 'down'
        ) {
          return
        }
      }

      const inAddPlaylistDialog = Boolean(document.querySelector('[data-tv-add-pl-dialog="1"]'))

      if (isRemoteBackKey(e)) {
        e.preventDefault()
        if (document.querySelector('[data-tv-modal-open="1"]')) {
          window.dispatchEvent(new CustomEvent('tv-modal-escape'))
          return
        }
        onBack?.()
        return
      }

      if (inAddPlaylistDialog) return

      const plan = planRef.current
      if (!plan) return

      const mapKey = mapRemoteKeyToDirection(e)

      if (isRemoteEnterKey(e)) {
        const el = focusedId ? elementsRef.current.get(focusedId) : null
        const clickable = el?.querySelector<HTMLElement>('[data-tv-activate]')
        if (clickable) {
          e.preventDefault()
          clickable.click()
        }
        return
      }

      if (!mapKey) return

      e.preventDefault()
      let current = focusedId ?? plan.defaultFocusId
      if (!elementsRef.current.get(current)) {
        current = plan.defaultFocusId
      }
      const next = plan.neighbors[current]?.[mapKey]
      if (next) setFocusedIdState(next)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [focusedId, onBack])

  const value = useMemo(
    () => ({
      focusedId,
      setFocusedId,
      register,
      unregister,
      isFocused,
      mountPlan,
      unmountPlan,
      onBack,
    }),
    [
      focusedId,
      setFocusedId,
      register,
      unregister,
      isFocused,
      mountPlan,
      unmountPlan,
      onBack,
    ],
  )

  return (
    <TvFocusContext.Provider value={value}>{children}</TvFocusContext.Provider>
  )
}

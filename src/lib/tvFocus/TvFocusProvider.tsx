import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import type { ElementRef } from './context'
import { TvFocusContext } from './context'
import type { TvFocusPlan } from './types'
import { tvFocusIdStore } from './tvFocusIdStore'
import {
  isRemoteBackKey,
  isRemoteEnterKey,
  isSamsungTizenLikeRuntime,
  mapRemoteKeyToDirection,
} from './tvRemoteKeys'

function elementFullyVisibleInNearestScroller(el: HTMLElement): boolean {
  const parent = el.parentElement
  if (!parent) return true

  const scroller = el.closest('.scrollbar-tv, .nl-scroll-list, .playlists-page__list, [data-tv-scroll]')
  if (!(scroller instanceof HTMLElement)) return true

  const containerRect = scroller.getBoundingClientRect()
  const elementRect = el.getBoundingClientRect()
  const margin = 10

  return (
    elementRect.top >= containerRect.top + margin &&
    elementRect.bottom <= containerRect.bottom - margin
  )
}

function isKeyEventInsideAttr(e: KeyboardEvent, attr: string): boolean {
  const selector = `[${attr}]`
  const ae = document.activeElement
  if (ae instanceof HTMLElement && ae.closest(selector)) return true
  if (e.target instanceof HTMLElement && e.target.closest(selector)) return true
  // Tizen: activeElement pode ficar em <body> mesmo após el.focus() em tabIndex={-1}.
  // Fallback: verificar pelo elemento DOM correspondente ao ID lógico do store.
  const storeId = tvFocusIdStore.get()
  if (storeId) {
    const storeEl = document.getElementById(`focus-${storeId}`)
    if (storeEl instanceof HTMLElement && storeEl.closest(selector)) return true
  }
  return false
}

export function TvFocusProvider({
  children,
  onBack,
}: {
  children: ReactNode
  onBack?: () => void
}) {
  const elementsRef = useRef<Map<string, ElementRef>>(new Map())
  const planRef = useRef<TvFocusPlan | null>(null)
  const onBackRef = useRef(onBack)
  const lastNavMsRef = useRef<number>(0)
  const lastBackMsRef = useRef<number>(0)

  const handleBackAction = useCallback(() => {
    if (document.querySelector('[data-tv-modal-open="1"]')) {
      window.dispatchEvent(new CustomEvent('tv-modal-escape'))
      return
    }
    // Permitir que páginas interceptem o Back antes de navegar (ex.: Live TV: preview→canais→categorias)
    const ev = new CustomEvent('tv-page-back', { cancelable: true })
    window.dispatchEvent(ev)
    if (ev.defaultPrevented) return
    onBackRef.current?.()
  }, [])

  useEffect(() => {
    onBackRef.current = onBack
  }, [onBack])

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
    const prev = tvFocusIdStore.get()
    const next =
      prev && plan.neighbors[prev] ? prev : plan.defaultFocusId
    tvFocusIdStore.set(next)
  }, [])

  const unmountPlan = useCallback(() => {
    planRef.current = null
    tvFocusIdStore.set(null)
  }, [])

  const setFocusedId = useCallback((id: string | null) => {
    tvFocusIdStore.set(id)
  }, [])

  const isFocused = useCallback((id: string) => tvFocusIdStore.get() === id, [])

  const applyDirection = useCallback((dir: NonNullable<ReturnType<typeof mapRemoteKeyToDirection>>) => {
    const plan = planRef.current
    if (!plan) return

    const focusedId = tvFocusIdStore.get()
    let current = focusedId ?? plan.defaultFocusId
    if (!elementsRef.current.get(current)) {
      current = plan.defaultFocusId
    }
    const next = plan.neighbors[current]?.[dir]
    if (next) tvFocusIdStore.set(next)
  }, [])

  useEffect(() => {
    function applyFocusToId(id: string, attempt: number) {
      if (document.querySelector('[data-tv-add-pl-dialog="1"]')) return
      // Se um modal está aberto, só aplicar foco a elementos DENTRO do modal.
      // Evita que onMouseEnter nos posters de fundo roube o foco dos botões do modal.
      const modal = document.querySelector('[data-tv-modal-open="1"]')
      if (modal) {
        const candidate = elementsRef.current.get(id)
        if (!candidate || !modal.contains(candidate)) return
      }
      const el = elementsRef.current.get(id)
      if (!el) {
        // Elemento ainda não registrou o ref (race condition em Tizen com CPU lento).
        // Retry até 2 frames de animação; aborta se o store mudou entretanto.
        if (attempt < 2) {
          requestAnimationFrame(() => {
            if (tvFocusIdStore.get() === id) applyFocusToId(id, attempt + 1)
          })
        }
        return
      }
      if (document.activeElement !== el) {
        el.focus({ preventScroll: true })
      }
      if (!elementFullyVisibleInNearestScroller(el)) {
        el.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: isSamsungTizenLikeRuntime() ? 'instant' : 'smooth',
        })
      }
    }

    return tvFocusIdStore.subscribe(() => {
      const id = tvFocusIdStore.get()
      if (id) applyFocusToId(id, 0)
    })
  }, [])

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

      /** Modal VOD/Radix (portal): o foco pode cair em `body` ou fora do Content — não roubar ←→/Enter para o plano da página.
       * Usa presença DOM em vez de isKeyEventInsideAttr porque no Tizen o activeElement pode
       * permanecer em <body> mesmo após focus() programático, fazendo a detecção por foco falhar. */
      const modalOpen = !!document.querySelector('[data-tv-modal-open="1"]')
      if (modalOpen) {
        if (dirEarly || isRemoteEnterKey(e)) {
          return
        }
      }

      // Usa presença DOM em vez de isKeyEventInsideAttr — no Tizen, e.target
      // permanece em <body> mesmo com foco programático, tornando a detecção
      // por atributo do target infiável (mesma causa do bug do modal).
      if (!!document.querySelector('[data-live-tv-page="1"]') && (dirEarly || isRemoteEnterKey(e))) {
        return
      }
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('header') &&
        dirEarly === 'down'
      ) {
        return
      }

      if (!!document.querySelector('[data-iptv-vod-main="1"]') && (dirEarly || isRemoteEnterKey(e))) {
        return
      }

      if (!!document.querySelector('[data-iptv-series-main="1"]') && (dirEarly || isRemoteEnterKey(e))) {
        return
      }

      const inAddPlaylistDialog = isKeyEventInsideAttr(e, 'data-tv-add-pl-dialog="1"')

      if (isRemoteBackKey(e)) {
        e.preventDefault()
        const nowBack = Date.now()
        if (nowBack - lastBackMsRef.current < 300) return
        lastBackMsRef.current = nowBack
        handleBackAction()
        return
      }

      if (inAddPlaylistDialog) return

      const mapKey = mapRemoteKeyToDirection(e)

      if (isRemoteEnterKey(e)) {
        const fid = tvFocusIdStore.get()
        const el = fid ? elementsRef.current.get(fid) : null
        const clickable = el?.querySelector<HTMLElement>('[data-tv-activate]')
        if (clickable) {
          e.preventDefault()
          clickable.click()
        }
        return
      }

      if (!mapKey) return

      e.preventDefault()
      e.stopPropagation()

      // `e.repeat` é não confiável em Tizen WebKit ≤56 (D-pad nunca seta repeat=true).
      // Usar debounce de timestamp para evitar saltos múltiplos ao segurar uma seta.
      const now = Date.now()
      if (now - lastNavMsRef.current < 150) return
      lastNavMsRef.current = now
      applyDirection(mapKey)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [applyDirection, handleBackAction])

  useEffect(() => {
    const onShellMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      if ((data as { type?: string }).type !== 'iptv-shell-back') return
      // Debounce: o shell pode enviar múltiplos postMessages para o mesmo Back press
      // (tizenhwkey + keydown). Sem debounce, o segundo chega após React remover o modal
      // e handleBackAction cai no onBack → navigate('/home').
      const nowBack = Date.now()
      if (nowBack - lastBackMsRef.current < 300) return
      lastBackMsRef.current = nowBack
      handleBackAction()
    }

    const onTizenHwKey = (event: Event) => {
      const e = event as Event & { keyName?: string }
      if (String(e.keyName ?? '').toLowerCase() !== 'back') return
      event.preventDefault?.()
      // Debounce compartilhado com o handler keydown para evitar duplo disparo no Tizen.
      const nowBack = Date.now()
      if (nowBack - lastBackMsRef.current < 300) return
      lastBackMsRef.current = nowBack
      handleBackAction()
    }

    window.addEventListener('message', onShellMessage)
    document.addEventListener('tizenhwkey', onTizenHwKey as EventListener, true)
    return () => {
      window.removeEventListener('message', onShellMessage)
      document.removeEventListener('tizenhwkey', onTizenHwKey as EventListener, true)
    }
  }, [handleBackAction])

  const value = useMemo(
    () => ({
      setFocusedId,
      register,
      unregister,
      isFocused,
      mountPlan,
      unmountPlan,
    }),
    [setFocusedId, register, unregister, isFocused, mountPlan, unmountPlan],
  )

  return (
    <TvFocusContext.Provider value={value}>{children}</TvFocusContext.Provider>
  )
}

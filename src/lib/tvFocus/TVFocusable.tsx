import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useTvFocus } from './useTvFocus'
import { tvFocusIdStore } from './tvFocusIdStore'
import { isSamsungTizenLikeRuntime } from './tvRemoteKeys'

export function TVFocusable({
  id,
  className = '',
  focusScale = true,
  onBecameFocused,
  children,
}: {
  id: string
  className?: string
  /** Se falso, não aplica `scale` ao foco (listas estilo nexus / IPTV). */
  focusScale?: boolean
  /** Chamado quando este nó recebe foco (útil para sincronizar estado da página). */
  onBecameFocused?: (id: string) => void
  children: ReactNode
}) {
  const { register, unregister, setFocusedId } = useTvFocus()
  const elRef = useRef<HTMLDivElement | null>(null)
  const focusedRef = useRef(false)

  const applyFocusedClass = useCallback(
    (focused: boolean) => {
      const el = elRef.current
      if (!el) return
      if (focusedRef.current === focused) return
      focusedRef.current = focused
      el.classList.toggle('tv-focusable--focused', focused)
      if (focused) onBecameFocused?.(id)
    },
    [id, onBecameFocused],
  )

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      elRef.current = el
      register(id, el)
      if (el) {
        const focused = tvFocusIdStore.get() === id
        focusedRef.current = focused
        el.classList.toggle('tv-focusable--focused', focused)
        // Cobre a race condition onde mountPlan disparou antes deste elemento registrar.
        // O subscriber do provider já tentou aplicar o foco mas não encontrou o ref —
        // ao registrar agora, aplicamos diretamente se este é o alvo corrente.
        if (focused && document.activeElement !== el) {
          el.focus({ preventScroll: true })
        }
      }
    },
    [id, register],
  )

  useEffect(() => () => unregister(id), [id, unregister])

  useEffect(() => {
    applyFocusedClass(tvFocusIdStore.get() === id)
    return tvFocusIdStore.subscribe(() => {
      applyFocusedClass(tvFocusIdStore.get() === id)
    })
  }, [applyFocusedClass, id])

  /**
   * Sempre -1: a ordem do Tab não deve percorrer listas/grelhas (centenas de nós).
   * O foco vem de `tvFocusIdStore` + `element.focus()` (D-pad / provider), que funciona com -1.
   */
  return (
    <div
      ref={setRef}
      id={`focus-${id}`}
      tabIndex={-1}
      className={`tv-focusable ${!focusScale ? 'tv-focusable--no-scale' : ''} ${className}`.trim()}
      onMouseEnter={isSamsungTizenLikeRuntime() ? undefined : () => setFocusedId(id)}
    >
      {children}
    </div>
  )
}

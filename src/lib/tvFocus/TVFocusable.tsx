import { useCallback, useEffect, type ReactNode } from 'react'
import { useTvFocus } from './useTvFocus'
import { isSamsungTizenLikeRuntime } from './tvRemoteKeys'

export function TVFocusable({
  id,
  className = '',
  onBecameFocused,
  children,
}: {
  id: string
  className?: string
  /** Chamado quando este nó recebe foco (útil para sincronizar estado da página). */
  onBecameFocused?: (id: string) => void
  children: ReactNode
}) {
  const { register, unregister, isFocused } = useTvFocus()
  const focused = isFocused(id)

  useEffect(() => {
    if (focused) onBecameFocused?.(id)
  }, [focused, id, onBecameFocused])

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      register(id, el)
    },
    [id, register],
  )

  useEffect(() => () => unregister(id), [id, unregister])

  const tabIndex = isSamsungTizenLikeRuntime() ? 0 : -1

  return (
    <div
      ref={setRef}
      id={`focus-${id}`}
      tabIndex={tabIndex}
      className={`tv-focusable ${focused ? 'tv-focusable--focused' : ''} ${className}`.trim()}
    >
      {children}
    </div>
  )
}

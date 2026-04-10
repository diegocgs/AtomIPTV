import { useLayoutEffect, type RefObject } from 'react'

/**
 * Mantém o cartaz focado visível dentro do contentor com scroll da grelha VOD.
 */
export function useVodGridScrollIntoView(opts: {
  scrollRef: RefObject<HTMLElement | null>
  idPrefix: string
  focusedItemIndex: number
  activePanel: 'categories' | 'grid'
  itemCount: number
}) {
  const { scrollRef, idPrefix, focusedItemIndex, activePanel, itemCount } = opts

  useLayoutEffect(() => {
    if (activePanel !== 'grid' || itemCount === 0) return
    const idx = Math.max(0, Math.min(focusedItemIndex, itemCount - 1))
    const focusDomId = `focus-${idPrefix}-mv-${idx}`

    let cancelled = false
    let attempt = 0

    const tick = () => {
      if (cancelled) return
      const row = document.getElementById(focusDomId)
      const container = scrollRef.current
      if (row && container?.contains(row)) {
        const margin = 12
        const c = container.getBoundingClientRect()
        const b = row.getBoundingClientRect()
        if (b.top < c.top + margin) {
          container.scrollTop += b.top - c.top - margin
        } else if (b.bottom > c.bottom - margin) {
          container.scrollTop += b.bottom - c.bottom + margin
        }
        return
      }
      attempt += 1
      if (attempt < 12) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    return () => {
      cancelled = true
    }
  }, [scrollRef, idPrefix, focusedItemIndex, activePanel, itemCount])
}

import { useLayoutEffect, useState, type RefObject } from 'react'
import { estimateVodGridColumnsFromViewport, readCssGridColumnCount } from '@/lib/vodGridNav'

/**
 * Colunas efetivas do CSS grid de posters (breakpoints 2–6), para navegação D-pad ↑↓←→.
 */
export function useVodGridColumns(gridRef: RefObject<HTMLElement | null>): number {
  const [cols, setCols] = useState(() => estimateVodGridColumnsFromViewport())

  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const sync = () => {
      const read = readCssGridColumnCount(el)
      const est = estimateVodGridColumnsFromViewport()
      setCols(read >= 2 ? read : est)
    }
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    sync()
    window.addEventListener('resize', sync)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [gridRef])

  return cols
}

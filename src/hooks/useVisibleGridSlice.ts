import { useEffect, useRef, useState, type RefObject } from 'react'
import { detectTvRuntime } from '@/lib/tvPlatform'

function getGridChunkSize(): { initial: number; step: number } {
  const runtime = detectTvRuntime()
  if (runtime === 'tizen') {
    return { initial: 80, step: 60 }
  }
  return { initial: 48, step: 48 }
}

/**
 * Renderiza a grelha em blocos (evita milhares de nós DOM / TVFocusable de uma vez).
 * O scroll é detetado dentro de `scrollRootRef` (contentor com overflow).
 */
export function useVisibleGridSlice<T>(
  items: readonly T[],
  resetKey: string | number,
  scrollRootRef: RefObject<HTMLElement | null>,
  /** Índice no array completo que deve ficar incluído no slice (ex.: foco D-pad). */
  expandToIncludeIndex?: number,
): {
  visibleItems: T[]
  loadMoreRef: RefObject<HTMLDivElement | null>
  totalCount: number
  visibleCount: number
} {
  const { initial: initialChunk, step: stepChunk } = getGridChunkSize()
  const [visibleCount, setVisibleCount] = useState(initialChunk)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect -- virtualization state is intentionally synchronized to active grid data and focused index */
  useEffect(() => {
    setVisibleCount(Math.min(initialChunk, items.length))
  }, [resetKey, items.length, initialChunk])

  useEffect(() => {
    if (expandToIncludeIndex == null || expandToIncludeIndex < 0) return
    setVisibleCount((v) => {
      const need = Math.min(items.length, expandToIncludeIndex + 1)
      if (need <= v) return v
      const stepped = Math.ceil(need / stepChunk) * stepChunk
      return Math.min(items.length, Math.max(v, stepped))
    })
  }, [expandToIncludeIndex, items.length, stepChunk])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const root = scrollRootRef.current
    const sentinel = loadMoreRef.current
    if (!root || !sentinel || visibleCount >= items.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((v) => Math.min(v + stepChunk, items.length))
        }
      },
      { root, rootMargin: '400px 0px', threshold: 0 },
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [items.length, visibleCount, scrollRootRef, stepChunk])

  return {
    visibleItems: items.slice(0, visibleCount),
    loadMoreRef,
    totalCount: items.length,
    visibleCount,
  }
}

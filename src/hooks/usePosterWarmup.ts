import { useEffect } from 'react'
import { detectTvRuntime } from '@/lib/tvPlatform'
import { warmPosterUrls } from '@/lib/posterWarmCache'

export function usePosterWarmup(
  urls: readonly string[],
  depsKey: string,
  focusedIndex?: number,
): void {
  useEffect(() => {
    if (urls.length === 0) return

    const runtime = detectTvRuntime()
    const baseWindow = runtime === 'tizen' ? 1200 : 96
    const start = Math.max(0, (focusedIndex ?? 0) - (runtime === 'tizen' ? 48 : 12))
    const end = Math.min(urls.length, start + baseWindow)
    const slice = urls.slice(start, end)

    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return
      void warmPosterUrls(slice, { concurrency: runtime === 'tizen' ? 24 : 6 })
    }, runtime === 'tizen' ? 0 : 30)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [urls, depsKey, focusedIndex])
}

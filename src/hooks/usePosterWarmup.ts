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

    const ac = new AbortController()
    const timer = window.setTimeout(() => {
      if (ac.signal.aborted) return
      void warmPosterUrls(slice, { concurrency: runtime === 'tizen' ? 24 : 6, signal: ac.signal })
    }, runtime === 'tizen' ? 0 : 30)

    return () => {
      window.clearTimeout(timer)
      ac.abort()
    }
  }, [urls, depsKey, focusedIndex])
}

/** Colunas efetivas de um CSS grid (ex. `repeat(6, minmax(0, 1fr))` ou 6 faixas em px). */
export function readCssGridColumnCount(gridEl: HTMLElement | null): number {
  if (!gridEl || typeof window === 'undefined') return 1
  const gtc = window.getComputedStyle(gridEl).gridTemplateColumns.trim()
  if (!gtc || gtc === 'none') return 1
  const repeatM = /^repeat\(\s*(\d+)/i.exec(gtc)
  if (repeatM) return Math.max(1, parseInt(repeatM[1]!, 10))
  const n = gtc.split(/\s+/).filter(Boolean).length
  return Math.max(1, n)
}

/** Alinhado aos breakpoints Tailwind do grid VOD (2→6 colunas). */
export function estimateVodGridColumnsFromViewport(): number {
  if (typeof window === 'undefined') return 6
  const w = window.innerWidth
  if (w >= 1280) return 6
  if (w >= 1024) return 5
  if (w >= 768) return 4
  if (w >= 640) return 3
  return 2
}

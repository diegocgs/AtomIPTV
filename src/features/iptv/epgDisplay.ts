export interface XtreamShortEpgEntry {
  title: string
  description: string
  startSec: number
  endSec: number
}

export const epgProgressPercent = (
  entry: XtreamShortEpgEntry,
  nowSec: number = Math.floor(Date.now() / 1000),
): number => {
  const span = entry.endSec - entry.startSec
  if (span <= 0) return 0
  const t = (nowSec - entry.startSec) / span
  return Math.round(Math.min(1, Math.max(0, t)) * 100)
}

const formatEpgClock = (unixSec: number): string =>
  new Date(unixSec * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

export const formatEpgRange = (startSec: number, endSec: number): string =>
  `${formatEpgClock(startSec)} - ${formatEpgClock(endSec)}`

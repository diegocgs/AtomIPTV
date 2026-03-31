import type { ContinueWatchingItem } from '@/types/catalog'
import { img } from './constants'

export const mockContinueWatching: ContinueWatchingItem[] = [
  {
    id: 'cw-1',
    title: 'Aurora Line',
    posterUrl: img.poster('cw-aurora'),
    type: 'movie',
    refId: 'mv-aurora',
    progressPct: 37,
    durationMin: 118,
  },
  {
    id: 'cw-2',
    title: 'North Harbor · T1 Ep.3',
    posterUrl: img.poster('cw-north'),
    type: 'series',
    refId: 'sr-north',
    progressPct: 62,
    durationMin: 52,
  },
  {
    id: 'cw-3',
    title: 'Sport TV 1',
    posterUrl: img.square('cw-sport'),
    type: 'channel',
    refId: 'ch-sportv',
    progressPct: 12,
  },
  {
    id: 'cw-4',
    title: 'Último Strike',
    posterUrl: img.poster('cw-strike'),
    type: 'movie',
    refId: 'mv-strike',
    progressPct: 88,
    durationMin: 108,
  },
]

import type { Episode } from '@/types/catalog'
import { img } from './constants'

export const mockEpisodes: Episode[] = [
  {
    id: 'ep-north-s1e1',
    seriesId: 'sr-north',
    title: 'Maré negra',
    season: 1,
    number: 1,
    thumbnailUrl: img.wide('ep-north-s1e1'),
    durationMin: 52,
    type: 'episode',
  },
  {
    id: 'ep-north-s1e2',
    seriesId: 'sr-north',
    title: 'Cais 7',
    season: 1,
    number: 2,
    thumbnailUrl: img.wide('ep-north-s1e2'),
    durationMin: 49,
    type: 'episode',
  },
  {
    id: 'ep-crown-s1e1',
    seriesId: 'sr-crown',
    title: 'Coroa partida',
    season: 1,
    number: 1,
    thumbnailUrl: img.wide('ep-crown-s1e1'),
    durationMin: 58,
    type: 'episode',
  },
]

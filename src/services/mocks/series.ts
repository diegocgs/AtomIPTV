import type { SeriesShow } from '@/types/catalog'
import { img } from './constants'

export const mockSeries: SeriesShow[] = [
  {
    id: 'sr-north',
    title: 'North Harbor',
    posterUrl: img.poster('sr-north'),
    categoryId: 'sc-crime',
    type: 'series',
    description:
      'Detetives num porto do norte investigam desaparecimentos ligados ao contrabando.',
    year: 2024,
    seasons: 3,
  },
  {
    id: 'sr-crown',
    title: 'The Hollow Crown',
    posterUrl: img.poster('sr-crown'),
    categoryId: 'sc-fantasy',
    type: 'series',
    description:
      'Reinos em guerra e magia que cobra um preço visível.',
    year: 2023,
    seasons: 2,
  },
  {
    id: 'sr-signal',
    title: 'Signal 9',
    posterUrl: img.poster('sr-signal'),
    categoryId: 'sc-trending',
    type: 'series',
    description:
      'Equipa de emergência e hackers colidem numa cidade monitorizada 24/7.',
    year: 2025,
    seasons: 1,
  },
  {
    id: 'sr-ledger',
    title: 'Ledger',
    posterUrl: img.poster('sr-ledger'),
    categoryId: 'sc-crime',
    type: 'series',
    description:
      'Contabilista descobre uma rede de branqueamento com ramificações políticas.',
    year: 2022,
    seasons: 4,
  },
  {
    id: 'sr-ash',
    title: 'Ash & Tide',
    posterUrl: img.poster('sr-ash'),
    categoryId: 'sc-fantasy',
    type: 'series',
    description:
      'Ilhas místicas, marés que param no meio do dia e um mapa que muda sozinho.',
    year: 2021,
    seasons: 2,
  },
  {
    id: 'sr-metro',
    title: 'Metro Blue',
    posterUrl: img.poster('sr-metro'),
    categoryId: 'sc-trending',
    type: 'series',
    description:
      'Vidas cruzadas na última linha de metro antes do encerramento.',
    year: 2024,
    seasons: 2,
  },
]

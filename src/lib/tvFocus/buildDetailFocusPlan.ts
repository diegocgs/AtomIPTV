import { APP_HDR, buildAppTopBar, mergeNeighborMaps } from './buildMaps'
import type { TvFocusPlan, TvNeighborMap } from './types'

/** Detalhe: barra superior + voltar / ações; esquerda volta ao logo (home). */
export function buildDetailFocusPlan(): TvFocusPlan {
  const back = APP_HDR.logo
  const shell = buildAppTopBar('det-back')
  const neighbors: TvNeighborMap = mergeNeighborMaps(shell, {
    'det-back': {
      up: APP_HDR.logo,
      down: 'det-primary',
      left: back,
      right: undefined,
    },
    'det-primary': {
      up: 'det-back',
      down: 'det-fav',
      left: back,
      right: undefined,
    },
    'det-fav': {
      up: 'det-primary',
      down: undefined,
      left: back,
      right: undefined,
    },
  })
  return { neighbors, defaultFocusId: 'det-primary' }
}

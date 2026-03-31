import { APP_HDR, buildAppTopBar } from './buildMaps'
import type { TvFocusPlan, TvNeighborMap } from './types'

/**
 * Live TV em 3 colunas: categorias | lista de canais | preview.
 * Sem nó de foco na pesquisa (o input roubava o foco no comando Samsung).
 * Setas: esquerda/direita entre colunas; cima/baixo dentro de cada coluna.
 */
export function buildLiveTvLegacyFocusPlan(
  categoryCount: number,
  channelCount: number,
  lastCategoryFocusId: string,
  lastChannelFocusId: string,
): TvFocusPlan {
  const neighbors: TvNeighborMap = {}

  const firstMain =
    categoryCount > 0
      ? 'lcat-0'
      : channelCount > 0
        ? 'lch-0'
        : 'lpv-0'

  const shell = buildAppTopBar(firstMain)
  Object.assign(neighbors, shell)

  const catMatch = /^lcat-(\d+)$/.exec(lastCategoryFocusId)
  const catIdx = catMatch
    ? Math.min(parseInt(catMatch[1]!, 10), Math.max(0, categoryCount - 1))
    : 0

  const chMatch = /^lch-(\d+)$/.exec(lastChannelFocusId)
  const chIdx =
    channelCount > 0
      ? Math.min(parseInt(chMatch?.[1] ?? '0', 10), channelCount - 1)
      : 0

  const logoLeft = APP_HDR.logo

  const leftFromPreview =
    channelCount > 0 ? `lch-${chIdx}` : categoryCount > 0 ? `lcat-${catIdx}` : logoLeft

  const catRightTarget =
    channelCount > 0 ? 'lch-0' : 'lpv-0'

  for (let i = 0; i < categoryCount; i++) {
    const id = `lcat-${i}`
    neighbors[id] = {
      up: i === 0 ? logoLeft : `lcat-${i - 1}`,
      down: i < categoryCount - 1 ? `lcat-${i + 1}` : undefined,
      right: catRightTarget,
      left: logoLeft,
    }
  }

  for (let j = 0; j < channelCount; j++) {
    const id = `lch-${j}`
    const upFirst =
      categoryCount > 0 ? `lcat-${catIdx}` : logoLeft
    neighbors[id] = {
      up: j === 0 ? upFirst : `lch-${j - 1}`,
      down: j < channelCount - 1 ? `lch-${j + 1}` : undefined,
      right: 'lpv-0',
      left: categoryCount > 0 ? `lcat-${catIdx}` : logoLeft,
    }
  }

  const previewUp =
    channelCount > 0
      ? 'lch-0'
      : categoryCount > 0
        ? `lcat-${catIdx}`
        : logoLeft

  neighbors['lpv-0'] = {
    left: leftFromPreview,
    right: undefined,
    up: previewUp,
    down: 'lpv-1',
  }
  neighbors['lpv-1'] = {
    left: leftFromPreview,
    right: undefined,
    up: 'lpv-0',
    down: 'lpv-2',
  }
  neighbors['lpv-2'] = {
    left: leftFromPreview,
    right: undefined,
    up: 'lpv-1',
    down: undefined,
  }

  return { neighbors, defaultFocusId: firstMain }
}

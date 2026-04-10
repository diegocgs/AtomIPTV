import type { TvFocusPlan, TvNeighborMap } from './types'

const SB = (i: number) => `sb-${i}`

/** IDs do `HomeChromeHeader` (Home e rotas internas — mesmo componente). */
export const APP_HDR = {
  profile: 'hdr-profile',
  settings: 'hdr-settings',
  power: 'hdr-power',
} as const

/**
 * Cabeçalho cromado: Logo · Perfil · Definições · Power.
 * Seta para baixo em qualquer um entra em `mainEntryDown` (primeiro foco da página).
 */
export function buildAppTopBar(mainEntryDown: string): TvNeighborMap {
  const { profile, settings, power } = APP_HDR
  return {
    [profile]: {
      left: undefined,
      right: settings,
      down: mainEntryDown,
      up: undefined,
    },
    [settings]: {
      left: profile,
      right: power,
      down: mainEntryDown,
      up: undefined,
    },
    [power]: {
      left: settings,
      right: undefined,
      down: mainEntryDown,
      up: undefined,
    },
  }
}

/**
 * Movies/Series: logo continua a descer para o primeiro foco da página (`shellMainFocusId`);
 * perfil / definições / power descem para a search da grelha (à direita), como no layout.
 */
export function buildVodCatalogHeaderNeighbors(
  shellMainFocusId: string,
  gridSearchId: string,
): TvNeighborMap {
  const base = buildAppTopBar(shellMainFocusId)
  const { profile, settings, power } = APP_HDR
  const p = base[profile]
  const s = base[settings]
  const pw = base[power]
  if (!p || !s || !pw) return base
  return {
    ...base,
    [profile]: { ...p, down: gridSearchId },
    [settings]: { ...s, down: gridSearchId },
    [power]: { ...pw, down: gridSearchId },
  }
}

/** @deprecated Preferir `buildAppTopBar` — menu lateral removido. */
export function buildShellSidebar(
  sidebarCount: number,
  mainEntryId: string,
): TvNeighborMap {
  const neighbors: TvNeighborMap = {}
  for (let i = 0; i < sidebarCount; i++) {
    const id = SB(i)
    neighbors[id] = {
      up: i > 0 ? SB(i - 1) : undefined,
      down: i < sidebarCount - 1 ? SB(i + 1) : undefined,
      right: mainEntryId,
    }
  }
  return neighbors
}

/** Sidebar com N itens; foco inicial na sidebar (primeiro item). */
export function buildSidebarMainPlan(
  sidebarCount: number,
  mainEntryId: string,
): TvFocusPlan {
  return {
    neighbors: buildShellSidebar(sidebarCount, mainEntryId),
    defaultFocusId: SB(0),
  }
}

/** Liga `mainEntry` à sidebar: esquerda volta para `sbIndex`. */
export function withMainLeftToSidebar(
  neighbors: TvNeighborMap,
  mainEntryId: string,
  sbIndex: number,
): TvNeighborMap {
  return {
    ...neighbors,
    [mainEntryId]: {
      ...neighbors[mainEntryId],
      left: SB(sbIndex),
    },
  }
}

/** Grelha com ids `g-${row}-${col}`; `cols` por linha pode variar por linha. */
export function buildGridNeighbors(
  rows: number,
  colsPerRow: number[],
  options: {
    /** Id à esquerda da coluna 0 (ex.: categoria). */
    leftColumnId?: string
    /** Ao sair da grelha para a esquerda na col 0 — usa leftColumnId ou omit. */
    leftFromFirstCol?: boolean
  } = {},
): TvNeighborMap {
  const neighbors: TvNeighborMap = {}
  const { leftColumnId, leftFromFirstCol = true } = options

  const idAt = (r: number, c: number) => `g-${r}-${c}`

  for (let r = 0; r < rows; r++) {
    const cols = colsPerRow[r] ?? colsPerRow[0] ?? 0
    for (let c = 0; c < cols; c++) {
      const id = idAt(r, c)
      const up = r > 0 && c < (colsPerRow[r - 1] ?? 0) ? idAt(r - 1, c) : undefined
      const down =
        r < rows - 1 && c < (colsPerRow[r + 1] ?? 0) ? idAt(r + 1, c) : undefined
      const left =
        c > 0
          ? idAt(r, c - 1)
          : leftFromFirstCol && leftColumnId
            ? leftColumnId
            : undefined
      const right = c < cols - 1 ? idAt(r, c + 1) : undefined
      neighbors[id] = { up, down, left, right }
    }
  }

  return neighbors
}

/** Lista vertical de categorias `cat-${i}`; à direita entra na grelha em `gridEntry`. */
export function mergeCategoryGrid(
  categoryCount: number,
  gridNeighbors: TvNeighborMap,
  gridEntryId: string,
  /** Coluna 0 da grelha volta para a categoria atualmente realçada (ex. última focada). */
  leftTargetIdForGrid: string,
): TvNeighborMap {
  const neighbors = { ...gridNeighbors }
  for (let i = 0; i < categoryCount; i++) {
    const id = `cat-${i}`
    neighbors[id] = {
      up: i > 0 ? `cat-${i - 1}` : undefined,
      down: i < categoryCount - 1 ? `cat-${i + 1}` : undefined,
      right: gridEntryId,
    }
  }
  for (const key of Object.keys(neighbors)) {
    if (!key.startsWith('g-')) continue
    const parts = key.split('-')
    const col = Number(parts[2])
    if (col !== 0) continue
    const cur = neighbors[key] ?? {}
    neighbors[key] = { ...cur, left: leftTargetIdForGrid }
  }
  const entry = neighbors[gridEntryId] ?? {}
  neighbors[gridEntryId] = {
    ...entry,
    left: leftTargetIdForGrid,
  }
  return neighbors
}

/** Linha horizontal `row-${rowIndex}-${col}` com `count` colunas. */
export function buildHorizontalRow(
  rowIndex: number,
  count: number,
  links: Partial<{
    up: string
    down: string
    leftIntoSidebar: string
  }>,
): TvNeighborMap {
  const neighbors: TvNeighborMap = {}
  const prefix = `row-${rowIndex}`
  for (let c = 0; c < count; c++) {
    const id = `${prefix}-${c}`
    neighbors[id] = {
      left: c > 0 ? `${prefix}-${c - 1}` : links.leftIntoSidebar,
      right: c < count - 1 ? `${prefix}-${c + 1}` : undefined,
      up: links.up,
      down: links.down,
    }
  }
  return neighbors
}

export function mergeNeighborMaps(...maps: TvNeighborMap[]): TvNeighborMap {
  return maps.reduce((acc, m) => {
    const next = { ...acc }
    for (const k of Object.keys(m)) {
      next[k] = { ...next[k], ...m[k] }
    }
    return next
  }, {} as TvNeighborMap)
}

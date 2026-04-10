/**
 * Samsung AVPlay: `setDisplayRect` usa sempre o sistema 1920×1080, independentemente
 * da resolução da app. Sem escalar quando `clientWidth` ≠ 1920, o vídeo pode ficar
 * fora do sítio (áudio continua).
 * @see https://developer.samsung.com/smarttv/develop/guides/multimedia/media-playback/using-avplay.html
 */
export const AVPLAY_COORD_BASE_WIDTH = 1920
export const AVPLAY_COORD_BASE_HEIGHT = 1080

/** Largura de layout em px (coordenadas de `getBoundingClientRect`), alinhada ao eixo usado pela TV. */
export function getViewportWidthForAvPlayScale(): number {
  if (typeof window === 'undefined') return AVPLAY_COORD_BASE_WIDTH
  try {
    const topWindow = window.top
    const topVv = topWindow?.visualViewport?.width
    if (typeof topVv === 'number' && topVv > 0) return topVv
    const topCw = topWindow?.document?.documentElement?.clientWidth
    if (typeof topCw === 'number' && topCw > 0) return topCw
  } catch {
    /* cross-origin / sandboxed shells can block top access */
  }
  const vv = window.visualViewport?.width
  if (typeof vv === 'number' && vv > 0) return vv
  const cw = document.documentElement?.clientWidth
  if (typeof cw === 'number' && cw > 0) return cw
  return Math.max(1, window.innerWidth || AVPLAY_COORD_BASE_WIDTH)
}

/** Altura de layout em px (coordenadas de `getBoundingClientRect`), alinhada ao eixo usado pela TV. */
export function getViewportHeightForAvPlayScale(): number {
  if (typeof window === 'undefined') return AVPLAY_COORD_BASE_HEIGHT
  try {
    const topWindow = window.top
    const topVv = topWindow?.visualViewport?.height
    if (typeof topVv === 'number' && topVv > 0) return topVv
    const topCh = topWindow?.document?.documentElement?.clientHeight
    if (typeof topCh === 'number' && topCh > 0) return topCh
  } catch {
    /* cross-origin / sandboxed shells can block top access */
  }
  const vv = window.visualViewport?.height
  if (typeof vv === 'number' && vv > 0) return vv
  const ch = document.documentElement?.clientHeight
  if (typeof ch === 'number' && ch > 0) return ch
  return Math.max(1, window.innerHeight || AVPLAY_COORD_BASE_HEIGHT)
}

export function getAvplayDisplayRectFromElement(el: HTMLElement): {
  x: number
  y: number
  width: number
  height: number
} {
  const clientW = getViewportWidthForAvPlayScale()
  const clientH = getViewportHeightForAvPlayScale()
  const ratioX = AVPLAY_COORD_BASE_WIDTH / Math.max(1, clientW)
  const ratioY = AVPLAY_COORD_BASE_HEIGHT / Math.max(1, clientH)
  const r = el.getBoundingClientRect()
  let offsetLeft = 0
  let offsetTop = 0
  try {
    const frame = window.frameElement
    if (frame instanceof HTMLElement) {
      const fr = frame.getBoundingClientRect()
      offsetLeft = fr.left
      offsetTop = fr.top
    }
  } catch {
    /* cross-origin shell access can fail; fall back to local rect */
  }
  return {
    x: Math.floor((r.left + offsetLeft) * ratioX),
    y: Math.floor((r.top + offsetTop) * ratioY),
    width: Math.max(1, Math.floor(r.width * ratioX)),
    height: Math.max(1, Math.floor(r.height * ratioY)),
  }
}

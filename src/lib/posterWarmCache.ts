/**
 * Pré-aquecimento do cache de posters via elementos <img>.
 *
 * Estratégia deliberada: CDNs de providers IPTV não enviam cabeçalhos CORS,
 * portanto `fetch(..., { mode: 'cors' })` falha e loga erros no DevTools mesmo
 * que o JS apanhe a excepção — e ainda duplica os pedidos (1 fetch + 1 img).
 * Com <img> não há CORS, não há erros, e o HTTP cache do browser é primado
 * da mesma forma. As <img> tags na UI encontram as imagens em cache
 * nas renderizações seguintes.
 */

const inFlight = new Set<string>()

/** Pré-carrega uma imagem via <img>, primando o HTTP cache do browser. */
function warmImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = src
  })
}

/** @deprecated Mantido por compatibilidade — retorna sempre null agora que não usamos objectURLs. */
export function getResolvedPosterUrlSync(_src: string): string | null {
  return null
}

/** Resolve o URL de um poster, primando o HTTP cache via <img> se necessário. */
export async function resolvePosterUrl(src: string): Promise<string> {
  const trimmed = src.trim()
  if (!trimmed) return src
  if (!inFlight.has(trimmed)) {
    inFlight.add(trimmed)
    void warmImage(trimmed).finally(() => inFlight.delete(trimmed))
  }
  return trimmed
}

/** Pré-aquece uma lista de URLs de poster em paralelo (concurrency limitado). */
export async function warmPosterUrls(
  urls: readonly string[],
  options?: { concurrency?: number },
): Promise<void> {
  const unique = Array.from(
    new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0)),
  )
  if (unique.length === 0) return

  const concurrency = Math.max(1, options?.concurrency ?? 6)
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < unique.length) {
      const current = unique[cursor++]
      if (!current) continue
      await warmImage(current).catch(() => { /* best effort */ })
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, () => worker()))
}

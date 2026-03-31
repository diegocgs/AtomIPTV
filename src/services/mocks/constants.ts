/** Placeholders estáveis (picsum com seed fixo) — leves e previsíveis em dev. */
export const img = {
  wide: (seed: string, w = 640, h = 360) =>
    `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`,
  poster: (seed: string, w = 400, h = 600) =>
    `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`,
  square: (seed: string, s = 256) =>
    `https://picsum.photos/seed/${encodeURIComponent(seed)}/${s}/${s}`,
} as const

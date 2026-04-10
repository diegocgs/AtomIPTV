/** Estado global do id focado — evita re-render de todos os TVFocusable a cada seta. */
export type TvFocusIdListener = () => void

let focusedId: string | null = null
const listeners = new Set<TvFocusIdListener>()

export const tvFocusIdStore = {
  get(): string | null {
    return focusedId
  },
  set(next: string | null): void {
    if (next === focusedId) return
    focusedId = next
    listeners.forEach((l) => l())
  },
  subscribe(listener: TvFocusIdListener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

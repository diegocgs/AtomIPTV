export function moveCaretToEndOnFocus(e: { target: HTMLInputElement }): void {
  const el = e.target
  const len = el.value.length
  queueMicrotask(() => {
    try {
      el.setSelectionRange(len, len)
    } catch {
      /* ignore */
    }
  })
}

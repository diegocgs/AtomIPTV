import { mapRemoteKeyToDirection } from '@/lib/tvFocus/tvRemoteKeys'

function stopModalKeyEvent(e: KeyboardEvent): void {
  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()
}

function isTabKey(e: KeyboardEvent): boolean {
  return e.key === 'Tab' || (e as KeyboardEvent & { keyCode?: number }).keyCode === 9
}

/**
 * Tab / Shift+Tab entre os botões do modal.
 * O Radix `FocusScope` com `loop` só trata primeiro/último tabbable; isto cobre toda a linha.
 */
export function tryNavigateModalActionTab(
  e: KeyboardEvent,
  modalRoot: HTMLElement | null,
  actionIds: readonly string[],
): boolean {
  if (!isTabKey(e) || e.altKey || e.ctrlKey || e.metaKey) return false
  if (!modalRoot) return false

  const focusables = actionIds
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
  if (focusables.length === 0) return false

  const ae = document.activeElement
  if (!(ae instanceof HTMLElement)) return false

  /** Foco fora do modal (body / Tizen) — primeira tabulação entra na linha de ações. */
  if (!modalRoot.contains(ae)) {
    stopModalKeyEvent(e)
    const start = e.shiftKey ? focusables.length - 1 : 0
    focusables[start]?.focus({ preventScroll: true })
    return true
  }

  stopModalKeyEvent(e)
  const idx = focusables.findIndex((el) => el === ae || el.contains(ae))
  const currentIdx = idx < 0 ? 0 : idx
  const delta = e.shiftKey ? -1 : 1
  const next = (currentIdx + delta + focusables.length) % focusables.length
  focusables[next]?.focus({ preventScroll: true })
  return true
}

/**
 * TV / remote: move foco entre uma linha fixa de ações num modal.
 * Usar com listener em capture na `window` quando o modal está aberto (antes do Radix FocusScope).
 * Usa `mapRemoteKeyToDirection` — em Tizen `key` pode vir vazio e só `keyCode` 37/39.
 */
export function tryNavigateModalActionRow(
  e: KeyboardEvent,
  modalRoot: HTMLElement | null,
  actionIds: readonly string[],
): boolean {
  const dir = mapRemoteKeyToDirection(e)
  if (dir !== 'left' && dir !== 'right') return false
  if (!modalRoot) return false

  const focusables = actionIds
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el instanceof HTMLElement)

  if (focusables.length === 0) return false

  const ae = document.activeElement
  if (!(ae instanceof HTMLElement)) return false

  /** Foco ainda em `body` / fora do painel (Radix) — primeira seta entra na linha de ações. */
  if (!modalRoot.contains(ae)) {
    stopModalKeyEvent(e)
    const start = dir === 'right' ? 0 : focusables.length - 1
    focusables[start]?.focus({ preventScroll: true })
    return true
  }

  const idx = focusables.findIndex((el) => el === ae || el.contains(ae))
  if (idx < 0) {
    stopModalKeyEvent(e)
    const start = dir === 'right' ? 0 : focusables.length - 1
    focusables[start]?.focus({ preventScroll: true })
    return true
  }

  stopModalKeyEvent(e)
  const delta = dir === 'right' ? 1 : -1
  const next = (idx + delta + focusables.length) % focusables.length
  focusables[next]?.focus({ preventScroll: true })
  return true
}

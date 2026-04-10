export type TvRemoteKey =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'enter'
  | 'back'
  | 'escape'
  | 'unknown';

export const TV_BACK_KEYCODES = new Set<number>([
  8, // Backspace
  27, // Escape
  10009, // Samsung Tizen Back
  461, // LG webOS Back
  4, // Some Android TV runtimes
]);

const TV_ENTER_KEYCODES = new Set<number>([13, 29443]);
const TV_UP_KEYCODES = new Set<number>([38]);
const TV_DOWN_KEYCODES = new Set<number>([40]);
const TV_LEFT_KEYCODES = new Set<number>([37]);
const TV_RIGHT_KEYCODES = new Set<number>([39]);

export function toTvRemoteKey(e: KeyboardEvent): TvRemoteKey {
  const key = e.key;
  const code = e.code;
  const keyCode = (e as KeyboardEvent & { keyCode?: number }).keyCode ?? -1;

  if (key === 'ArrowUp' || TV_UP_KEYCODES.has(keyCode)) return 'up';
  if (key === 'ArrowDown' || TV_DOWN_KEYCODES.has(keyCode)) return 'down';
  if (key === 'ArrowLeft' || TV_LEFT_KEYCODES.has(keyCode)) return 'left';
  if (key === 'ArrowRight' || TV_RIGHT_KEYCODES.has(keyCode)) return 'right';
  if (key === 'Enter' || code === 'NumpadEnter' || TV_ENTER_KEYCODES.has(keyCode)) return 'enter';

  if (
    key === 'Escape' ||
    key === 'Backspace' ||
    key === 'GoBack' ||
    key === 'BrowserBack' ||
    TV_BACK_KEYCODES.has(keyCode)
  ) {
    if (key === 'Escape') return 'escape';
    return 'back';
  }

  return 'unknown';
}

export function isTvBackKey(e: KeyboardEvent): boolean {
  const k = toTvRemoteKey(e);
  return k === 'back' || k === 'escape';
}

export function isTypingLikeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function shouldIgnoreGlobalTvKey(e: KeyboardEvent): boolean {
  if (e.defaultPrevented) return true;
  if (e.isComposing) return true;
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  if (isTypingLikeTarget(e.target)) return true;
  return false;
}

/** Enter/OK: Samsung/LG remotes sometimes only populate legacy keyCode (13 / 29443). */
export function isRemoteEnter(e: KeyboardEvent): boolean {
  if (e.key === 'Enter' || e.key === 'NumpadEnter') return true;
  const keyCode = (e as KeyboardEvent & { keyCode?: number }).keyCode ?? -1;
  const which = (e as KeyboardEvent & { which?: number }).which ?? -1;
  const k = keyCode > 0 ? keyCode : which;
  return TV_ENTER_KEYCODES.has(k) || k === 13;
}

export const APP_DATA_RELOAD_EVENT = 'nexus-app-data-reload';

/** Mesma chave que Live TV usa para restaurar o último canal na sessão do browser. */
export const NEXUS_LIVE_LAST_CHANNEL_SESSION_KEY = 'nexus-live-last-channel-id';

let reloadSeq = 0;
let moviesUiResetAppliedUpTo = 0;
let seriesUiResetAppliedUpTo = 0;

/** Valor atual para sincronizar o estado do hook ao montar o ecrã após um reload. */
export function getAppDataReloadSeq(): number {
  return reloadSeq;
}

/** Só deve correr o reset local (pesquisas, modais) uma vez por acionamento de Reload, não a cada remount. */
export function consumeMoviesReloadUiReset(seq: number): boolean {
  if (seq === 0) return false;
  if (seq <= moviesUiResetAppliedUpTo) return false;
  moviesUiResetAppliedUpTo = seq;
  return true;
}

export function consumeSeriesReloadUiReset(seq: number): boolean {
  if (seq === 0) return false;
  if (seq <= seriesUiResetAppliedUpTo) return false;
  seriesUiResetAppliedUpTo = seq;
  return true;
}

export function clearAppSessionCaches(): void {
  try {
    sessionStorage.removeItem(NEXUS_LIVE_LAST_CHANNEL_SESSION_KEY);
  } catch {
    /* quota / private mode */
  }
}

/**
 * Limpa chaves de sessão usadas pelo app
 * e notifica ecrãs montados para voltarem a pedir dados ao servidor.
 */
export function triggerAppDataReload(): void {
  reloadSeq += 1;
  clearAppSessionCaches();
  window.dispatchEvent(new CustomEvent(APP_DATA_RELOAD_EVENT, { detail: reloadSeq }));
}

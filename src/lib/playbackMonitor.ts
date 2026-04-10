/**
 * Ring buffer de diagnóstico de playback (HLS / <video>) para ver na TV em Settings
 * e em paralelo em console (Web Inspector / sdb).
 */

export const PLAYBACK_MONITOR_EVENT = 'nexus-playback-monitor-log';

const MAX_LINES = 280;
const lines: string[] = [];

/** Remove credenciais óbvias de URLs de stream (Xtream, query password). */
export function sanitizePlaybackUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    for (const key of ['password', 'pass', 'pwd', 'token']) {
      if (u.searchParams.has(key)) u.searchParams.set(key, '***');
    }
    let p = u.pathname;
    p = p.replace(/\/(live|movie|series)\/[^/]+\/[^/]+(\/|$)/gi, '/$1/***/***$2');
    u.pathname = p;
    return u.toString();
  } catch {
    return s.length > 200 ? `${s.slice(0, 200)}…` : s;
  }
}

function nowStamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

export function playbackMonitorLog(scope: string, message: string, extra?: string): void {
  const line = extra
    ? `[${nowStamp()}] [${scope}] ${message} | ${extra}`
    : `[${nowStamp()}] [${scope}] ${message}`;
  lines.push(line);
  while (lines.length > MAX_LINES) lines.shift();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PLAYBACK_MONITOR_EVENT, { detail: line }));
  }
  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[StreamPro-playback]', line);
  }
}

export function getPlaybackMonitorLines(): readonly string[] {
  return lines;
}

export function clearPlaybackMonitor(): void {
  lines.length = 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PLAYBACK_MONITOR_EVENT, { detail: '__cleared__' }));
  }
}

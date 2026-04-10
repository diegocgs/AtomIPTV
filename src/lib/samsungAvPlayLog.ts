import { shouldLogSamsungAvPlay } from '@/lib/samsungTvTarget';

export function samsungAvPlayLog(...args: unknown[]): void {
  if (!shouldLogSamsungAvPlay()) return;
  console.log('[SamsungAVPlay]', ...args);
}

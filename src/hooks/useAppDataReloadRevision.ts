import { useEffect, useState } from 'react';
import { APP_DATA_RELOAD_EVENT, getAppDataReloadSeq } from '@/lib/appDataReload';

/**
 * Segue o contador global quando o utilizador aciona Reload na home (`triggerAppDataReload`).
 * O estado inicial usa `getAppDataReloadSeq()` para ficar correto ao montar o ecrã logo após um reload.
 */
export function useAppDataReloadRevision(): number {
  const [n, setN] = useState(getAppDataReloadSeq);

  useEffect(() => {
    const onReload = (e: Event) => {
      const d = (e as CustomEvent<number>).detail;
      setN(typeof d === 'number' ? d : prev => prev + 1);
    };
    window.addEventListener(APP_DATA_RELOAD_EVENT, onReload);
    return () => window.removeEventListener(APP_DATA_RELOAD_EVENT, onReload);
  }, []);

  return n;
}

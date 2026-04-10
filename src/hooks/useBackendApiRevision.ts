import { useEffect, useState } from 'react';

const EVENT = 'nexus-backend-api-changed';

/** Incrementa quando o URL do backend proxy muda (Settings / localStorage). */
export function useBackendApiRevision(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const bump = () => setN(x => x + 1);
    window.addEventListener(EVENT, bump);
    return () => window.removeEventListener(EVENT, bump);
  }, []);
  return n;
}

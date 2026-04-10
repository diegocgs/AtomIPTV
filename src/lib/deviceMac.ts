function normalizeMacForDisplay(raw: string): string {
  const s = raw.trim();
  if (/^[0-9a-fA-F]{12}$/.test(s)) {
    const pairs = s.match(/.{1,2}/g);
    return pairs ? pairs.join(':').toUpperCase() : s;
  }
  return s;
}

function tryBridgeStringMethods(obj: Record<string, unknown>, methodNames: readonly string[]): string | undefined {
  for (const name of methodNames) {
    const fn = obj[name];
    if (typeof fn !== 'function') continue;
    try {
      const out = (fn as () => unknown)();
      if (typeof out === 'string' && out.trim()) return out.trim();
    } catch {
      /* WebView bridge may throw if hardware MAC is restricted */
    }
  }
  return undefined;
}

type DeviceMacInject = { mac?: string; macAddress?: string };

/**
 * MAC do aparelho para exibição. Em browser comum não há API Web para MAC.
 * Em WebView / app TV, o shell pode:
 * - definir `window.STREAMPRO_DEVICE.mac` (ou `macAddress`) antes do bundle;
 * - expor `Android.getMacAddress()` / `getMac` / `getEthernetMacAddress` / `getWifiMacAddress`;
 * - ou fixar `VITE_DEVICE_MAC` no build para testes/dispositivo conhecido.
 */
export function getDeviceMacAddressForDisplay(): string {
  const vite = import.meta.env.VITE_DEVICE_MAC;
  if (typeof vite === 'string' && vite.trim()) {
    return normalizeMacForDisplay(vite.trim());
  }

  if (typeof window === 'undefined') {
    return '—';
  }

  const w = window as Window & {
    STREAMPRO_DEVICE?: DeviceMacInject;
    Android?: Record<string, unknown>;
  };

  const injected = w.STREAMPRO_DEVICE?.mac ?? w.STREAMPRO_DEVICE?.macAddress;
  if (typeof injected === 'string' && injected.trim()) {
    return normalizeMacForDisplay(injected.trim());
  }

  const android = w.Android;
  if (android && typeof android === 'object') {
    const raw = tryBridgeStringMethods(android, [
      'getMacAddress',
      'getMac',
      'getEthernetMacAddress',
      'getWifiMacAddress',
    ]);
    if (raw) return normalizeMacForDisplay(raw);
  }

  return '—';
}

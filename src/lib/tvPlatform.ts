export type TvRuntime = 'tizen' | 'webos' | 'android-tv-web' | 'web';

export type TvRuntimeInfo = {
  runtime: TvRuntime;
  userAgent: string;
  hasTizenApi: boolean;
  hasWebOsApi: boolean;
};

declare global {
  interface Window {
    tizen?: {
      tvinputdevice?: {
        registerKey?: (keyName: string) => void;
      };
    };
    webOS?: {
      platformBack?: () => void;
    };
    PalmSystem?: unknown;
  }
}

function readUserAgentSafe(): string {
  if (typeof window === 'undefined') return 'web';
  return window.navigator.userAgent.toLowerCase();
}

export function detectTvRuntime(): TvRuntime {
  if (typeof window === 'undefined') return 'web';

  const ua = readUserAgentSafe();
  const hasTizenGlobal = typeof window.tizen !== 'undefined';
  const hasWebOsGlobal =
    typeof window.webOS !== 'undefined' || typeof window.PalmSystem !== 'undefined';

  if (hasTizenGlobal || ua.includes('tizen')) return 'tizen';
  if (hasWebOsGlobal || ua.includes('web0s') || ua.includes('webos') || ua.includes('netcast')) {
    return 'webos';
  }
  if (
    ua.includes('android tv') ||
    ua.includes('googletv') ||
    ua.includes('aft') ||
    ua.includes('bravia')
  ) {
    return 'android-tv-web';
  }
  return 'web';
}

export function getTvRuntimeInfo(): TvRuntimeInfo {
  const runtime = detectTvRuntime();
  const ua = typeof window === 'undefined' ? '' : readUserAgentSafe();
  return {
    runtime,
    userAgent: ua,
    hasTizenApi: typeof window !== 'undefined' && typeof window.tizen !== 'undefined',
    hasWebOsApi:
      typeof window !== 'undefined' &&
      (typeof window.webOS !== 'undefined' || typeof window.PalmSystem !== 'undefined'),
  };
}

export function registerTvPlatformKeys(runtime: TvRuntime = detectTvRuntime()): void {
  if (typeof window === 'undefined') return;
  if (runtime !== 'tizen') return;
  if (!window.tizen?.tvinputdevice?.registerKey) return;

  const keys = [
    'Exit',
    'ColorF0Red',
    'ColorF1Green',
    'ColorF2Yellow',
    'ColorF3Blue',
    'Back',
    'ChannelUp',
    'ChannelDown',
    // VolumeUp / VolumeDown / VolumeMute NÃO são registradas aqui:
    // ao registrar, o Tizen desvia essas teclas para o app em vez de
    // deixar o sistema operacional da TV controlar o volume nativamente.
    'MediaPlay',
    'MediaPause',
    'MediaPlayPause',
    'MediaStop',
    'MediaRewind',
    'MediaFastForward',
  ];

  for (const key of keys) {
    try {
      window.tizen.tvinputdevice.registerKey(key);
    } catch {
      // Ignore unsupported keys on specific TV firmwares.
    }
  }
}

export function initializeTvRuntime(): TvRuntimeInfo {
  const info = getTvRuntimeInfo();
  registerTvPlatformKeys(info.runtime);
  return info;
}

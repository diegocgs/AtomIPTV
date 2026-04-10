/**
 * Samsung TV / Tizen: build flag opcional + detecção em runtime (Hosted CloudFront sem flag).
 */

export function isSamsungTvBuild(): boolean {
  return import.meta.env.VITE_TARGET_PLATFORM === 'samsung-tv';
}

export function isSamsungTvRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.tizen !== 'undefined' || typeof window.webapis !== 'undefined';
}

/** True quando existe API AVPlay no runtime (ex.: Tizen WebView na TV). */
export function isSamsungAvPlayAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.webapis?.avplay !== 'undefined';
}

/**
 * Usar motor AVPlay em LiveStreamPreview/VOD quando:
 * - runtime: `webapis.avplay` existe (browser normal → false; TV Hosted / .wgt → true), ou
 * - build: `VITE_TARGET_PLATFORM=samsung-tv` (ex.: npm run build:samsung-tv, testes sem API no desktop).
 */
export function shouldUseSamsungAvPlay(): boolean {
  if (isSamsungAvPlayAvailable()) return true;
  return isSamsungTvBuild();
}

export function shouldLogSamsungAvPlay(): boolean {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_IPTV_DEBUG === 'true' ||
    isSamsungTvBuild() ||
    (typeof window !== 'undefined' && isSamsungAvPlayAvailable())
  );
}

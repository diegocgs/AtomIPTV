/**
 * Tipagem mínima para Samsung Tizen AVPlay (runtime real em dispositivo).
 * @see https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references/avplay-api
 */

export interface AvplayStreamingProperties {
  /** ex.: 'FULL' | 'NONE' */
  bufferingParam?: string
}

export interface AvplayListener {
  onbufferingstart?: () => void
  onbufferingprogress?: (percent: number) => void
  onbufferingcomplete?: () => void
  onstreamcompleted?: () => void
  oncurrentplaytime?: (ms: number) => void
  onevent?: (eventType: string, eventData: string) => void
  onerror?: (eventType: string) => void
  onsubtitlechange?: (duration: number, data: string) => void
  ondrmevent?: (drmEvent: string, drmData: string) => void
}

export interface TizenAvplay {
  open(url: string): void
  prepareAsync(successCallback: () => void, errorCallback: (err: unknown) => void): void
  play(): void
  pause(): void
  stop(): void
  close(): void
  seekTo(ms: number): void
  getDuration(): number
  getState(): string
  setListener(listener: AvplayListener): void
  setDisplayRect(x: number, y: number, width: number, height: number): void
  setDisplayType?(type: string): void
  setDisplayMethod?(method: string): void
  setStreamingProperty?(property: string, value: string): void
}

export interface TizenWebapis {
  avplay?: TizenAvplay
}

declare global {
  interface Window {
    webapis?: TizenWebapis
    tizen?: unknown
  }
}

export {}

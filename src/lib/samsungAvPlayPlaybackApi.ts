/** Imperative surface exposed to VOD overlay when using Tizen AVPlay (no HTMLVideoElement). */
export type SamsungAvPlayPlaybackApi = {
  getCurrentTimeSec: () => number;
  getDurationSec: () => number;
  seekToSec: (sec: number) => void;
  play: () => void;
  pause: () => void;
  isPaused: () => boolean;
  isEnded: () => boolean;
};

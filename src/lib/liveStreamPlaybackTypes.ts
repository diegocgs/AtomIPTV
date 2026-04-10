export type LiveStreamPlaybackMode = 'hls.js' | 'native-hls' | 'progressive' | 'avplay';

export type LiveStreamPlaybackPipelineInfo = {
  originalUrl: string;
  resolvedUrl: string;
  playbackMode: LiveStreamPlaybackMode;
  usedTvProxy: boolean;
  isHls: boolean;
};

export type LiveStreamPlaybackStatus =
  | 'loading'
  | 'playing'
  | 'buffering'
  | 'reconnecting'
  | 'error';

import { DEMO_PUBLIC_HLS_STREAM } from './constants'

/**
 * Resolve URL de playback para um canal do catálogo mock.
 * Em produção: substituir por lookup Xtream / playlist activa.
 */
export function resolveStreamUrlForChannelId(channelId: string): string {
  void channelId
  return DEMO_PUBLIC_HLS_STREAM
}

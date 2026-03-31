import type { PlaybackSource } from '@/types/playback'

/**
 * Ponto de integração futuro (AVPlay / motor nativo).
 * Fase 1: apenas UI estática — sem carregar stream.
 */
export function PlayerPlaceholder({
  source,
  title,
}: {
  source: PlaybackSource
  title: string
}) {
  return (
    <div
      className="player-placeholder"
      style={{
        marginTop: '1.25rem',
        padding: '1.25rem 1.5rem',
        borderRadius: 'var(--tv-radius-lg)',
        border: '1px solid var(--tv-border)',
        background: 'var(--tv-surface)',
        color: 'var(--tv-text-muted)',
        maxWidth: '560px',
      }}
    >
      <strong style={{ color: 'var(--tv-text)' }}>{title}</strong>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.95rem' }}>
        Área reservada ao leitor de vídeo. URI de exemplo:{' '}
        <code style={{ wordBreak: 'break-all' }}>{source.uri}</code>
      </p>
    </div>
  )
}

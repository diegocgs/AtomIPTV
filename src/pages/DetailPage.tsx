import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PlayerPlaceholder } from '@/features/player'
import { FocusPlan, TVFocusable } from '@/lib/tvFocus'
import { buildDetailFocusPlan } from '@/lib/tvFocus/buildDetailFocusPlan'
import { getItemByTypeAndId } from '@/services/catalogStore'
import { mockContinueWatching } from '@/services/mocks'
import type { DetailRouteType } from '@/types/catalog'

export function DetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>()
  const navigate = useNavigate()
  const detailType = type as DetailRouteType | undefined
  const item =
    detailType && id ? getItemByTypeAndId(detailType, id) : undefined

  const cw = useMemo(
    () => mockContinueWatching.find((x) => x.refId === id),
    [id],
  )

  const [fav, setFav] = useState(true)

  const plan = useMemo(() => buildDetailFocusPlan(), [])

  if (!detailType || !id || !item) {
    return (
      <div className="settings-placeholder">
        <p>Conteúdo não encontrado.</p>
        <button type="button" className="tv-btn" onClick={() => navigate(-1)}>
          Voltar
        </button>
      </div>
    )
  }

  const title = 'title' in item ? item.title : item.name
  const image = 'posterUrl' in item ? item.posterUrl : item.logoUrl
  const description = item.description
  const meta =
    detailType === 'movie' && item.type === 'movie'
      ? `${item.year} · ${item.durationMin} min`
      : detailType === 'series' && item.type === 'series'
        ? `${item.year} · ${item.seasons} temporadas`
        : item.type === 'channel' && item.number !== undefined
          ? `Canal ${item.number}`
          : item.type === 'channel'
            ? 'Canal'
            : ''

  return (
    <FocusPlan plan={plan}>
      <div className="detail">
        <div className="detail__poster">
          <img src={image} alt="" />
        </div>
        <div>
          <TVFocusable id="det-back">
            <button
              type="button"
              className="tv-btn"
              data-tv-activate
              onClick={() => navigate(-1)}
            >
              Voltar
            </button>
          </TVFocusable>
          <h1 className="tv-page-title" style={{ marginTop: '1rem' }}>
            {title}
          </h1>
          <p className="detail__meta">{meta}</p>
          <p className="detail__desc">{description}</p>
          {cw ? (
            <p className="detail__meta">
              Continuar a ver · {cw.progressPct}% concluído
            </p>
          ) : null}
          <div className="detail-actions">
            <TVFocusable id="det-primary">
              <button
                type="button"
                className="tv-btn tv-btn--primary"
                data-tv-activate
                onClick={() => {}}
              >
                Watch Now
              </button>
            </TVFocusable>
            <TVFocusable id="det-fav">
              <button
                type="button"
                className="tv-btn"
                data-tv-activate
                onClick={() => setFav((v) => !v)}
              >
                {fav ? 'Remover dos favoritos' : 'Favoritar'}
              </button>
            </TVFocusable>
          </div>
          <PlayerPlaceholder
            title="Pré-visualização do leitor"
            source={{
              uri: `placeholder://content/${detailType}/${id}`,
              title,
            }}
          />
        </div>
      </div>
    </FocusPlan>
  )
}

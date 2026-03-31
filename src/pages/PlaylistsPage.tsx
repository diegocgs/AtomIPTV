import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AddPlaylistDialog,
  entityToDialogEditModel,
  getPlaylistCardSubtitle,
  getPlaylistStatusLabel,
  usePlaylists,
} from '@/features/playlists'
import { FocusPlan, TVFocusable } from '@/lib/tvFocus'
import {
  buildPlaylistsDeleteDialogPlan,
  buildPlaylistsListFocusPlan,
} from '@/lib/tvFocus/buildPlaylistsFocusPlan'

function IconPlus() {
  return (
    <svg className="playlists-card__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg className="playlists-card__icon playlists-card__icon--play" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg className="playlists-act__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 16.5V20h3.5L17.5 9.9 14.1 6.5 4 16.5zM19.7 7.3a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.1 1.1 3.4 3.4 1.4-1.8z"
        fill="currentColor"
      />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg className="playlists-act__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 7h12M9 7V5h6v2m-7 4v8m4-8v8M10 11h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

type PlaylistsDialog =
  | null
  | { type: 'delete'; id: string }
  | { type: 'add' }
  | { type: 'edit'; id: string }

export function PlaylistsPage() {
  const { playlists, submitForm, setActivePlaylist, deletePlaylist } = usePlaylists()
  const [dialog, setDialog] = useState<PlaylistsDialog>(null)
  const [addSessionKey, setAddSessionKey] = useState(0)

  const deleteTarget = useMemo(
    () => (dialog?.type === 'delete' ? playlists.find((p) => p.id === dialog.id) ?? null : null),
    [dialog, playlists],
  )

  const editingModel = useMemo(() => {
    if (dialog?.type !== 'edit') return null
    const entity = playlists.find((p) => p.id === dialog.id)
    return entity ? entityToDialogEditModel(entity) : null
  }, [dialog, playlists])

  const addDialogOpen = dialog?.type === 'add' || dialog?.type === 'edit'

  useEffect(() => {
    const onEscape = () => setDialog(null)
    window.addEventListener('tv-modal-escape', onEscape)
    return () => window.removeEventListener('tv-modal-escape', onEscape)
  }, [])

  const plan = useMemo(() => {
    if (dialog?.type === 'delete') return buildPlaylistsDeleteDialogPlan()
    return buildPlaylistsListFocusPlan(playlists.length)
  }, [dialog, playlists.length])

  const handlePlaylistSubmit = useCallback(
    (payload: Parameters<typeof submitForm>[0]) => {
      return submitForm(payload, { makeActiveOnAdd: true })
    },
    [submitForm],
  )

  const confirmDelete = useCallback(() => {
    if (dialog?.type !== 'delete') return
    deletePlaylist(dialog.id)
    setDialog(null)
  }, [dialog, deletePlaylist])

  const activateCard = useCallback(
    (id: string) => {
      setActivePlaylist(id)
    },
    [setActivePlaylist],
  )

  return (
    <FocusPlan plan={plan}>
      <div className="playlists-page playlists-page--legacy">
        <h1 className="playlists-page__title">All Playlists</h1>

        <div className="playlists-page__grid">
          <TVFocusable id="pl-add" className="playlists-card-wrap">
            <div
              className="playlists-card playlists-card--add"
              data-tv-activate
              role="button"
              onClick={() => {
                setAddSessionKey((k) => k + 1)
                setDialog({ type: 'add' })
              }}
            >
              <div className="playlists-card__add-ring">
                <IconPlus />
              </div>
              <span className="playlists-card__add-label">Add Playlist</span>
            </div>
          </TVFocusable>

          {playlists.map((pl, index) => (
            <div key={pl.id} className="playlists-card-wrap playlists-card-wrap--with-actions">
              <TVFocusable id={`pl-c-${index}`} className="playlists-card-focus">
                <div
                  className={`playlists-card ${pl.isActive ? 'playlists-card--active' : ''}`}
                  data-tv-activate
                  role="button"
                  onClick={() => activateCard(pl.id)}
                >
                  <span className="playlists-card__badge">{pl.type}</span>
                  <div className="playlists-card__play-ring">
                    <IconPlay />
                  </div>
                  <span className="playlists-card__name">{pl.name}</span>
                  <span className="playlists-card__url" title={getPlaylistCardSubtitle(pl)}>
                    {getPlaylistCardSubtitle(pl)}
                  </span>
                  <span
                    className={`playlists-card__status ${pl.status === 'error' ? 'playlists-card__status--error' : ''}`}
                    title={pl.errorMessage ?? getPlaylistStatusLabel(pl.status)}
                  >
                    {pl.status === 'error' && pl.errorMessage
                      ? pl.errorMessage
                      : getPlaylistStatusLabel(pl.status)}
                  </span>
                  {pl.isActive ? <span className="playlists-card__active-pill">Active</span> : null}
                </div>
              </TVFocusable>
              <div className="playlists-card__actions">
                <TVFocusable id={`pl-e-${index}`} className="playlists-act">
                  <div
                    className="playlists-act__btn"
                    data-tv-activate
                    role="button"
                    onClick={() => setDialog({ type: 'edit', id: pl.id })}
                  >
                    <IconEdit />
                  </div>
                </TVFocusable>
                <TVFocusable id={`pl-d-${index}`} className="playlists-act">
                  <div
                    className="playlists-act__btn playlists-act__btn--danger"
                    data-tv-activate
                    role="button"
                    onClick={() => setDialog({ type: 'delete', id: pl.id })}
                  >
                    <IconTrash />
                  </div>
                </TVFocusable>
              </div>
            </div>
          ))}
        </div>
      </div>

      {dialog?.type === 'delete' ? (
        <div className="playlists-modal-root" data-tv-modal-open="1" role="presentation">
          <div className="playlists-modal-backdrop" aria-hidden />
          <div className="playlists-modal" role="alertdialog" aria-labelledby="pl-del-title">
            <h2 id="pl-del-title" className="playlists-modal__title">
              Remover playlist?
            </h2>
            <p className="playlists-modal__text">
              {deleteTarget
                ? `“${deleteTarget.name}” será removida.`
                : 'Esta playlist será removida.'}
            </p>
            <div className="playlists-modal__row">
              <TVFocusable id="pl-dlg-no" className="playlists-modal__focus">
                <button
                  type="button"
                  className="tv-btn playlists-modal__btn"
                  data-tv-activate
                  onClick={() => setDialog(null)}
                >
                  Não
                </button>
              </TVFocusable>
              <TVFocusable id="pl-dlg-yes" className="playlists-modal__focus">
                <button
                  type="button"
                  className="tv-btn tv-btn--primary playlists-modal__btn"
                  data-tv-activate
                  onClick={confirmDelete}
                >
                  Sim
                </button>
              </TVFocusable>
            </div>
          </div>
        </div>
      ) : null}

      <AddPlaylistDialog
        open={addDialogOpen}
        addSessionKey={addSessionKey}
        editing={editingModel}
        onOpenChange={(open) => {
          if (!open) {
            setDialog((cur) => (cur?.type === 'add' || cur?.type === 'edit' ? null : cur))
          }
        }}
        onSubmit={handlePlaylistSubmit}
      />
    </FocusPlan>
  )
}

import { useEffect, useLayoutEffect, useState } from 'react'
import type { PlaylistDialogEditModel, PlaylistFormPayload, PlaylistCommitResult } from './types/form'
import type { PlaylistType } from './types/playlist'
import {
  ADD_PL_IDS,
  focusElementById,
  getActiveFocusIdInOrder,
  getAddPlaylistVerticalOrder,
} from '@/lib/tvFocus/addPlaylistDialogNavigation'
import { mapRemoteKeyToDirection } from '@/lib/tvFocus/tvRemoteKeys'

function IconLink() {
  return (
    <svg className="add-pl-dialog__tab-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconServer() {
  return (
    <svg className="add-pl-dialog__tab-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="7" r="1" fill="currentColor" />
      <circle cx="7" cy="17" r="1" fill="currentColor" />
    </svg>
  )
}

export type AddPlaylistDialogProps = {
  open: boolean
  /** Incrementar ao abrir “Add” para forçar estado limpo quando key === add. */
  addSessionKey: number
  onOpenChange: (open: boolean) => void
  editing: PlaylistDialogEditModel | null
  /** Validação e persistência na camada de serviço; o modal só exibe erros. */
  onSubmit: (payload: PlaylistFormPayload) => PlaylistCommitResult
}

type FormState = {
  name: string
  url: string
  username: string
  password: string
  server: string
}

function buildInitialForm(editing: PlaylistDialogEditModel | null): FormState {
  if (!editing) {
    return { name: '', url: '', username: '', password: '', server: '' }
  }
  return {
    name: editing.displayName,
    url: editing.kind === 'm3u' ? editing.sourceUrl : '',
    username: editing.kind === 'xtream' ? (editing.xtreamUsername ?? '') : '',
    password: editing.kind === 'xtream' ? (editing.xtreamPassword ?? '') : '',
    server: editing.kind === 'xtream' ? editing.sourceUrl : '',
  }
}

function buildFormPayload(
  mode: 'add' | 'edit',
  editingId: string | undefined,
  kind: PlaylistType,
  formData: FormState,
): PlaylistFormPayload {
  const name = formData.name.trim()
  if (mode === 'add') {
    if (kind === 'm3u') {
      return { mode: 'add', kind: 'm3u', name, url: formData.url.trim() }
    }
    return {
      mode: 'add',
      kind: 'xtream',
      name,
      server: formData.server.trim(),
      username: formData.username.trim(),
      password: formData.password,
    }
  }
  if (!editingId) {
    throw new Error('AddPlaylistDialog: edit mode requires playlist id')
  }
  if (kind === 'm3u') {
    return { mode: 'edit', id: editingId, kind: 'm3u', name, url: formData.url.trim() }
  }
  return {
    mode: 'edit',
    id: editingId,
    kind: 'xtream',
    name,
    server: formData.server.trim(),
    username: formData.username.trim(),
    password: formData.password,
  }
}

type BodyProps = {
  editing: PlaylistDialogEditModel | null
  onSubmit: (payload: PlaylistFormPayload) => PlaylistCommitResult
  onOpenChange: (open: boolean) => void
}

function AddPlaylistDialogBody({ editing, onSubmit, onOpenChange }: BodyProps) {
  const [playlistType, setPlaylistType] = useState<PlaylistType>(() => editing?.kind ?? 'm3u')
  const [formData, setFormData] = useState<FormState>(() => buildInitialForm(editing))
  const [error, setError] = useState('')

  useLayoutEffect(() => {
    const tab = playlistType === 'm3u' ? ADD_PL_IDS.tabM3u : ADD_PL_IDS.tabXtream
    const t = window.setTimeout(() => {
      focusElementById(tab)
    }, 0)
    return () => window.clearTimeout(t)
    // Foco inicial ao montar (estado inicial já reflete add vs edit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const root = document.getElementById('iptv-add-pl-root')
      if (!root) return
      const target = e.target
      if (!(target instanceof Node) || !root.contains(target)) return

      const order = getAddPlaylistVerticalOrder(playlistType)
      let cur = getActiveFocusIdInOrder(order)
      if (!cur) {
        const bothTabs = [ADD_PL_IDS.tabM3u, ADD_PL_IDS.tabXtream] as const
        const t0 = getActiveFocusIdInOrder(bothTabs)
        if (t0) cur = t0
      }

      const dir = mapRemoteKeyToDirection(e)
      const isDown = dir === 'down'
      const isUp = dir === 'up'
      const isLeft = dir === 'left'
      const isRight = dir === 'right'

      if (cur === ADD_PL_IDS.tabM3u && isRight) {
        e.preventDefault()
        e.stopPropagation()
        setPlaylistType('xtream')
        focusElementById(ADD_PL_IDS.tabXtream)
        return
      }
      if (cur === ADD_PL_IDS.tabXtream && isLeft) {
        e.preventDefault()
        e.stopPropagation()
        setPlaylistType('m3u')
        focusElementById(ADD_PL_IDS.tabM3u)
        return
      }
      if (cur === ADD_PL_IDS.tabM3u && isLeft) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (cur === ADD_PL_IDS.tabXtream && isRight) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (cur === ADD_PL_IDS.submit && isRight) {
        e.preventDefault()
        e.stopPropagation()
        focusElementById(ADD_PL_IDS.cancel)
        return
      }
      if (cur === ADD_PL_IDS.cancel && isLeft) {
        e.preventDefault()
        e.stopPropagation()
        focusElementById(ADD_PL_IDS.submit)
        return
      }

      if (target instanceof HTMLInputElement && (isLeft || isRight)) {
        return
      }

      if (!cur && (isDown || isUp)) {
        if (isDown) {
          e.preventDefault()
          e.stopPropagation()
          focusElementById(order[0] ?? ADD_PL_IDS.tabM3u)
        }
        return
      }

      if (!cur) return

      const idx = order.indexOf(cur)
      if (idx < 0) return

      if (isDown && idx < order.length - 1) {
        e.preventDefault()
        e.stopPropagation()
        focusElementById(order[idx + 1]!)
        return
      }
      if (isUp && idx > 0) {
        e.preventDefault()
        e.stopPropagation()
        focusElementById(order[idx - 1]!)
      }
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [playlistType])

  const handleChange = (field: keyof FormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      setError('Playlist name is required')
      return
    }
    if (playlistType === 'm3u' && !formData.url.trim()) {
      setError('M3U URL is required')
      return
    }
    if (playlistType === 'xtream') {
      if (!formData.username.trim() || !formData.password.trim() || !formData.server.trim()) {
        setError('Username, password and server URL are required')
        return
      }
    }

    const payload = buildFormPayload(editing ? 'edit' : 'add', editing?.id, playlistType, formData)
    const result = onSubmit(payload)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    onOpenChange(false)
  }

  const title = editing ? 'Edit Playlist' : 'Add New Playlist'
  const submitLabel = editing ? 'Save changes' : 'Add Playlist'

  return (
    <>
      <header className="add-pl-dialog__header">
        <h2 id="add-pl-dialog-title" className="add-pl-dialog__title">
          {title}
        </h2>
        <p className="add-pl-dialog__subtitle">Connect your IPTV service</p>
      </header>

      <div id="iptv-add-pl-root" className="add-pl-dialog__body">
        <div className="add-pl-dialog__tabs" role="tablist" aria-label="Playlist type">
          <button
            type="button"
            role="tab"
            id={ADD_PL_IDS.tabM3u}
            aria-selected={playlistType === 'm3u'}
            tabIndex={playlistType === 'm3u' ? 0 : -1}
            className={`add-pl-dialog__tab ${playlistType === 'm3u' ? 'add-pl-dialog__tab--active' : ''}`}
            onClick={() => setPlaylistType('m3u')}
          >
            <IconLink />
            M3U URL
          </button>
          <button
            type="button"
            role="tab"
            id={ADD_PL_IDS.tabXtream}
            aria-selected={playlistType === 'xtream'}
            tabIndex={playlistType === 'xtream' ? 0 : -1}
            className={`add-pl-dialog__tab ${playlistType === 'xtream' ? 'add-pl-dialog__tab--active' : ''}`}
            onClick={() => setPlaylistType('xtream')}
          >
            <IconServer />
            Xtream Code
          </button>
        </div>

        <div className="add-pl-dialog__fields">
          <div className="add-pl-dialog__field">
            <label className="add-pl-dialog__label" htmlFor={ADD_PL_IDS.name}>
              Playlist Name
            </label>
            <input
              id={ADD_PL_IDS.name}
              type="text"
              autoComplete="off"
              placeholder="My Playlist"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="add-pl-dialog__input"
            />
          </div>

          {playlistType === 'm3u' ? (
            <div className="add-pl-dialog__field">
              <label className="add-pl-dialog__label" htmlFor={ADD_PL_IDS.url}>
                M3U URL
              </label>
              <input
                id={ADD_PL_IDS.url}
                type="url"
                inputMode="url"
                placeholder="http://example.com/playlist.m3u"
                value={formData.url}
                onChange={(e) => handleChange('url', e.target.value)}
                className="add-pl-dialog__input"
              />
            </div>
          ) : (
            <>
              <div className="add-pl-dialog__field">
                <label className="add-pl-dialog__label" htmlFor={ADD_PL_IDS.username}>
                  Username
                </label>
                <input
                  id={ADD_PL_IDS.username}
                  type="text"
                  autoComplete="username"
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  className="add-pl-dialog__input"
                />
              </div>
              <div className="add-pl-dialog__field">
                <label className="add-pl-dialog__label" htmlFor={ADD_PL_IDS.password}>
                  Password
                </label>
                <input
                  id={ADD_PL_IDS.password}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="add-pl-dialog__input"
                />
              </div>
              <div className="add-pl-dialog__field">
                <label className="add-pl-dialog__label" htmlFor={ADD_PL_IDS.server}>
                  Server URL
                </label>
                <input
                  id={ADD_PL_IDS.server}
                  type="url"
                  inputMode="url"
                  placeholder="http://example.com:8080"
                  value={formData.server}
                  onChange={(e) => handleChange('server', e.target.value)}
                  className="add-pl-dialog__input"
                />
                <p className="add-pl-dialog__hint">
                  Include host and port in one address (e.g. :8080).
                </p>
              </div>
            </>
          )}

          {error ? <div className="add-pl-dialog__error">{error}</div> : null}
        </div>

        <div className="add-pl-dialog__actions">
          <button
            type="button"
            id={ADD_PL_IDS.submit}
            className="add-pl-dialog__submit tv-btn tv-btn--primary"
            onClick={handleSubmit}
          >
            {submitLabel}
          </button>
          <button
            type="button"
            id={ADD_PL_IDS.cancel}
            className="add-pl-dialog__cancel"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

export function AddPlaylistDialog({
  open,
  addSessionKey,
  onOpenChange,
  editing,
  onSubmit,
}: AddPlaylistDialogProps) {
  if (!open) return null

  const formKey = editing ? editing.id : `add-${addSessionKey}`

  return (
    <div
      className="playlists-modal-root add-pl-dialog"
      data-tv-modal-open="1"
      data-tv-add-pl-dialog="1"
      role="presentation"
    >
      <button
        type="button"
        className="playlists-modal-backdrop add-pl-dialog__backdrop"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="playlists-modal add-pl-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-pl-dialog-title"
      >
        <AddPlaylistDialogBody key={formKey} editing={editing} onSubmit={onSubmit} onOpenChange={onOpenChange} />
      </div>
    </div>
  )
}

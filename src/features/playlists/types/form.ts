/**
 * Contrato entre o modal Add/Edit e a camada de serviço (sem expor entidades na UI).
 */
export type PlaylistFormPayload =
  | { mode: 'add'; kind: 'm3u'; name: string; url: string }
  | {
      mode: 'add'
      kind: 'xtream'
      name: string
      server: string
      username: string
      password: string
    }
  | { mode: 'edit'; id: string; kind: 'm3u'; name: string; url: string }
  | {
      mode: 'edit'
      id: string
      kind: 'xtream'
      name: string
      server: string
      username: string
      password: string
    }

/** Modelo mínimo para preencher o formulário de edição. */
export type PlaylistDialogEditModel = {
  id: string
  kind: 'm3u' | 'xtream'
  displayName: string
  sourceUrl: string
  xtreamUsername?: string
  xtreamPassword?: string
}

export type PlaylistCommitResult = { ok: true } | { ok: false; error: string }

/** Stable ids for Add Playlist dialog — TV D-pad linear order (aligned with nexus-vision-prime). */

export const ADD_PL_IDS = {
  tabM3u: 'iptv-add-pl-type-m3u',
  tabXtream: 'iptv-add-pl-type-xtream',
  name: 'iptv-add-pl-name',
  url: 'iptv-add-pl-url',
  username: 'iptv-add-pl-username',
  password: 'iptv-add-pl-password',
  server: 'iptv-add-pl-server',
  submit: 'iptv-add-pl-submit',
  cancel: 'iptv-add-pl-cancel',
} as const

export function getAddPlaylistVerticalOrder(
  playlistType: 'm3u' | 'xtream',
): readonly string[] {
  const activeTab = playlistType === 'm3u' ? ADD_PL_IDS.tabM3u : ADD_PL_IDS.tabXtream
  const tail = [ADD_PL_IDS.submit, ADD_PL_IDS.cancel] as const
  if (playlistType === 'm3u') {
    return [activeTab, ADD_PL_IDS.name, ADD_PL_IDS.url, ...tail]
  }
  return [activeTab, ADD_PL_IDS.name, ADD_PL_IDS.username, ADD_PL_IDS.password, ADD_PL_IDS.server, ...tail]
}

export function focusElementById(id: string): void {
  const el = document.getElementById(id)
  if (el && typeof el.focus === 'function') {
    el.focus({ preventScroll: true })
  }
}

export function getActiveFocusIdInOrder(order: readonly string[]): string | null {
  let el: Element | null = document.activeElement
  while (el) {
    if (el instanceof HTMLElement && el.id && order.includes(el.id)) {
      return el.id
    }
    el = el.parentElement
  }
  return null
}

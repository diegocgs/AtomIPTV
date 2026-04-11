function attr(line, key) {
  const d = new RegExp(`${key}="([^"]*)"`, 'i')
  const s = new RegExp(`${key}='([^']*)'`, 'i')
  return line.match(d)?.[1]?.trim() || line.match(s)?.[1]?.trim() || undefined
}

function extinfDisplayName(line) {
  const tvgName = attr(line, 'tvg-name')
  const comma = line.match(/,(.*)$/)
  const fromComma = comma ? comma[1].trim() : ''
  if (fromComma) return fromComma
  if (tvgName) return tvgName
  return 'Channel'
}

function* iterateLines(text) {
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '\n' || c === '\r') {
      yield text.slice(start, i)
      if (c === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++
      start = i + 1
    }
  }
  if (start < text.length) yield text.slice(start)
}

function isStreamUrlLine(line) {
  const t = line.trim()
  if (!t || t.startsWith('#')) return false
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t)
}

export function parseM3uText(text) {
  const out = []
  let pending = null
  for (const raw of iterateLines(text)) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#EXTINF')) {
      pending = {
        name: extinfDisplayName(line),
        tvgLogo: attr(line, 'tvg-logo'),
        groupTitle: attr(line, 'group-title'),
        tvgId: attr(line, 'tvg-id'),
      }
      continue
    }
    if (line.startsWith('#')) continue
    if (pending && isStreamUrlLine(line)) {
      out.push({
        name: pending.name ?? 'Channel',
        url: line.trim(),
        tvgLogo: pending.tvgLogo,
        groupTitle: pending.groupTitle,
        tvgId: pending.tvgId,
      })
      pending = null
    }
  }
  return out
}

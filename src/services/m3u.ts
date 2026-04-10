export type M3uEntry = {
  name: string;
  url: string;
  groupTitle: string;
  tvgLogo?: string;
  tvgId?: string;
};

type Attrs = Record<string, string>;

const parseAttrs = (s: string): Attrs => {
  const out: Attrs = {};
  // key="value" pairs (loose, good enough for common M3U)
  const re = /([\w-]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const k = m[1];
    const v = m[2];
    if (k) out[k] = v ?? '';
  }
  return out;
};

/**
 * Parse M3U text into entries.
 * Supports common IPTV format: `#EXTINF:-1 tvg-logo="..." group-title="..." ,Channel Name` + next line URL.
 */
export function parseM3u(text: string): M3uEntry[] {
  const lines = text
    .split(/\r?\n/g)
    .map(l => l.trim())
    .filter(Boolean);

  const out: M3uEntry[] = [];
  let pending: { name: string; groupTitle: string; tvgLogo?: string; tvgId?: string } | null = null;

  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      const commaIdx = line.indexOf(',');
      const meta = commaIdx >= 0 ? line.slice(0, commaIdx) : line;
      const name = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : '';
      const attrs = parseAttrs(meta);
      pending = {
        name: name || attrs['tvg-name'] || 'Channel',
        groupTitle: attrs['group-title']?.trim() || 'Live',
        tvgLogo: attrs['tvg-logo']?.trim() || undefined,
        tvgId: attrs['tvg-id']?.trim() || undefined,
      };
      continue;
    }
    if (line.startsWith('#')) continue;
    // first URL after EXTINF
    if (pending) {
      out.push({
        name: pending.name,
        url: line,
        groupTitle: pending.groupTitle,
        tvgLogo: pending.tvgLogo,
        tvgId: pending.tvgId,
      });
      pending = null;
    }
  }
  return out;
}

/**
 * Browsers bloqueiam `video.play()` com som até haver gesto do utilizador (refresh não conta).
 * @see https://goo.gl/xX8pDD
 */
export function isAutoplayPolicyError(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'NotAllowedError') {
    return true
  }
  if (err instanceof Error) {
    const m = err.message.toLowerCase()
    return (
      m.includes("user didn't interact") ||
      m.includes('notallowederror') ||
      m.includes('play() request was interrupted') ||
      m.includes('must be resumed') ||
      m.includes('not allowed by the user agent')
    )
  }
  return false
}

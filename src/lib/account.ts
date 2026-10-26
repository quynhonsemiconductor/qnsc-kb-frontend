/**
 * Small pure helpers behind the account page, kept out of the components so the wording
 * decisions (what a device is called, which line an activity row gets) are testable.
 */

export type DeviceInfo = { browser?: string; os?: string }

/** "Chrome · Windows", whichever half is known; empty when neither is. */
export function deviceLabel(device: DeviceInfo): string {
  return [device.browser, device.os].filter(Boolean).join(' · ')
}

/** Account events the server reports. Anything else renders as a generic row, not a blank. */
const KNOWN_ACTIVITY = new Set([
  'login',
  'logout',
  'password_change',
  'password_reset',
  'profile_update',
  'session_revoke',
  'sessions_revoke_others',
  'invitation_accept',
  'entra_identity_link',
])

export function activityKey(action: string): string {
  return KNOWN_ACTIVITY.has(action) ? `account.activity.${action}` : 'account.activity.other'
}

/** The first two letters of a name for the avatar, uppercase; "?" for no name at all. */
export function initials(name?: string | null): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? Array.from(words[0]).slice(0, 2) : [words[0], words[words.length - 1]].map(word => Array.from(word)[0])
  return letters.join('').toUpperCase()
}

/** A display name as the server will store it: single-spaced and trimmed. */
export function normalizeName(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').split(/\s+/).filter(Boolean).join(' ')
}

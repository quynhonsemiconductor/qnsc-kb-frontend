/**
 * The one place the password policy lives. The server enforces the same rules on
 * every credential endpoint (invitation accept, reset, change); mirroring them here
 * is purely so the user sees the problem before the round trip, never instead of it.
 */

export const PASSWORD_MIN_LENGTH = 12

/**
 * bcrypt hashes at most 72 BYTES and silently ignores the rest, so the ceiling is
 * measured in bytes, not characters. This matters for Vietnamese: "mật khẩu" is 8
 * characters but 11 bytes in UTF-8, so a `.length` check would let through a password
 * the server rejects.
 */
export const PASSWORD_MAX_BYTES = 72

const encoder = new TextEncoder()

export type PasswordStrength = 'weak' | 'fair' | 'strong'

export interface PasswordCheck {
  byteLength: number
  meetsMinLength: boolean
  withinMaxBytes: boolean
  /** True when the password satisfies every server-enforced rule. */
  valid: boolean
  strength: PasswordStrength
  /** i18n key for the first blocking problem, or null when nothing blocks submission. */
  problemKey: string | null
}

const characterClasses = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/]

export function checkPassword(password: string): PasswordCheck {
  const byteLength = encoder.encode(password).length
  const meetsMinLength = password.length >= PASSWORD_MIN_LENGTH
  const withinMaxBytes = byteLength <= PASSWORD_MAX_BYTES
  const valid = meetsMinLength && withinMaxBytes

  const variety = characterClasses.filter((pattern) => pattern.test(password)).length
  const strength: PasswordStrength = !valid
    ? 'weak'
    : password.length >= 16 && variety >= 3
      ? 'strong'
      : password.length >= 14 || variety >= 3
        ? 'fair'
        : 'weak'

  return {
    byteLength,
    meetsMinLength,
    withinMaxBytes,
    valid,
    strength,
    problemKey: !meetsMinLength ? 'auth.pwTooShort' : !withinMaxBytes ? 'auth.pwTooLong' : null,
  }
}

/**
 * The single gate every password form submits behind. Returns the i18n key of what is
 * wrong, or null when the pair is submittable.
 */
export function validatePasswordPair(password: string, confirmation: string): string | null {
  const check = checkPassword(password)
  if (check.problemKey) return check.problemKey
  if (password.length === 0 || password !== confirmation) return 'auth.passwordMismatch'
  return null
}

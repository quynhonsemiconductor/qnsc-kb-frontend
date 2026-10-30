type RoleCarrier = { role?: string; roles?: { name?: string }[] } | null | undefined

/**
 * Admin and CEO are the roles that may act on their own authority where others need a
 * review: publish without one, or decide which of two conflicting articles is right.
 * Mirrors the backend's `GovernanceService._may_self_approve`.
 */
export function isAdminOrCeo(user: RoleCarrier): boolean {
  if (!user) return false
  const names = [user.role, ...(user.roles ?? []).map(role => role.name)]
  return names.some(name => name === 'Admin' || name === 'CEO')
}

import type { ConnectorAclPrincipal } from '../api/connectors'

type Principal = Pick<ConnectorAclPrincipal, 'mapping_status' | 'auto_via' | 'auto_department_name'>

/** What decides first: a principal that still needs a person sorts above everything resolved. */
const RANK: Record<ConnectorAclPrincipal['mapping_status'], number> = { unmapped: 0, auto: 1, no_account: 2, ignored: 3, mapped: 4 }

export const aclStatusRank = (principal: Principal): number => RANK[principal.mapping_status] ?? 0

/** The badge for one provider principal: what it is, and how it came to be resolved. */
export function aclStatus(principal: Principal): { label: string; variant: 'success' | 'info' | 'warning' | 'default' } {
  switch (principal.mapping_status) {
    case 'mapped':
      return { label: 'Mapped', variant: 'success' }
    case 'auto': {
      const via =
        principal.auto_via === 'email' ? 'matched by e-mail'
        : principal.auto_via === 'name' ? `matched to ${principal.auto_department_name || 'a department'} by name`
        : principal.auto_via === 'company' ? 'whole organisation'
        : 'automatic'
      return { label: `Auto: ${via}`, variant: 'info' }
    }
    case 'ignored':
      return { label: 'Not a person: grants no access', variant: 'default' }
    case 'no_account':
      return { label: 'No account here yet: grants no access', variant: 'default' }
    default:
      return { label: 'Needs a decision', variant: 'warning' }
  }
}

/** How many principals still block approval, and how many were resolved without anyone's help. */
export function aclCounts(principals: Array<Pick<ConnectorAclPrincipal, 'mapping_status'>>): { needDecision: number; resolved: number } {
  const needDecision = principals.filter(principal => principal.mapping_status === 'unmapped').length
  return { needDecision, resolved: principals.length - needDecision }
}

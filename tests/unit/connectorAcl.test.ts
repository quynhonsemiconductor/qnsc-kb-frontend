import { describe, expect, it } from 'vitest'
import { aclCounts, aclStatus, aclStatusRank } from '../../src/utils/connectorAcl'

describe('provider principal status', () => {
  it('says how an automatic resolution was reached', () => {
    expect(aclStatus({ mapping_status: 'auto', auto_via: 'email' }).label).toBe('Auto: matched by e-mail')
    expect(aclStatus({ mapping_status: 'auto', auto_via: 'name', auto_department_name: 'Nhân sự' }).label).toBe('Auto: matched to Nhân sự by name')
    expect(aclStatus({ mapping_status: 'auto', auto_via: 'company' }).label).toBe('Auto: whole organisation')
    expect(aclStatus({ mapping_status: 'auto' }).label).toBe('Auto: automatic')
  })

  it('only an unmapped principal asks for a decision', () => {
    expect(aclStatus({ mapping_status: 'unmapped' })).toEqual({ label: 'Needs a decision', variant: 'warning' })
    for (const status of ['mapped', 'auto', 'ignored', 'no_account'] as const) {
      expect(aclStatus({ mapping_status: status }).variant).not.toBe('warning')
    }
  })

  it('says plainly that an ignored or accountless principal grants nothing', () => {
    expect(aclStatus({ mapping_status: 'ignored' }).label).toMatch(/grants no access/)
    expect(aclStatus({ mapping_status: 'no_account' }).label).toMatch(/grants no access/)
  })

  it('sorts what needs a person first', () => {
    const order = (['mapped', 'ignored', 'auto', 'unmapped', 'no_account'] as const)
      .map(mapping_status => ({ mapping_status }))
      .sort((a, b) => aclStatusRank(a) - aclStatusRank(b))
      .map(item => item.mapping_status)
    expect(order[0]).toBe('unmapped')
    expect(order.indexOf('auto')).toBeLessThan(order.indexOf('mapped'))
  })

  it('treats a status the server may add later as needing attention rather than hiding it', () => {
    expect(aclStatusRank({ mapping_status: 'something-new' as never })).toBe(0)
  })

  it('counts what still blocks and what resolved itself', () => {
    expect(aclCounts([{ mapping_status: 'unmapped' }, { mapping_status: 'auto' }, { mapping_status: 'no_account' }, { mapping_status: 'mapped' }])).toEqual({ needDecision: 1, resolved: 3 })
    expect(aclCounts([])).toEqual({ needDecision: 0, resolved: 0 })
  })
})

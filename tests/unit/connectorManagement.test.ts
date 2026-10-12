import { describe, expect, it } from 'vitest'
import {
  connectorPriority,
  getConnectorManagementState,
  getConnectorNextAction,
  matchesConnectorFilter,
  sortConnectorsForManagement,
  type ManageableConnector,
} from '../../src/lib/connector-management'

const connector = (overrides: Partial<ManageableConnector> = {}): ManageableConnector => ({
  id: 'source-1',
  name: 'Engineering Drive',
  system: 'google_drive',
  status: 'active',
  authorized: true,
  last_sync: '2026-10-12T00:00:00Z',
  ...overrides,
})

describe('connector management workflow', () => {
  it('turns unresolved connector state into one next action', () => {
    const unauthorized = connector({ authorized: false })
    const held = connector({ health: { documents_needing_attention: 3 } })
    const acl = connector({ last_error: 'Two permission principals are unmapped' })
    const newSource = connector({ last_sync: undefined })

    expect(getConnectorNextAction(unauthorized)).toBe('authorize')
    expect(getConnectorNextAction(held)).toBe('retry_held')
    expect(getConnectorNextAction(acl)).toBe('review_access')
    expect(getConnectorNextAction(newSource)).toBe('choose_locations')
    expect(getConnectorNextAction(connector())).toBe('sync')
  })

  it('includes operational health warnings in needs action', () => {
    const reconciling = connector({ health: { scopes: [{ full_sync_required: true, cursor_status: 'ready' }] } })

    expect(getConnectorManagementState(reconciling)).toBe('attention')
    expect(matchesConnectorFilter(reconciling, 'action')).toBe(true)
    expect(matchesConnectorFilter(reconciling, 'connected')).toBe(true)
    expect(matchesConnectorFilter(connector({ authorized: false }), 'connected')).toBe(false)
  })

  it('orders action-required sources before routine sync', () => {
    const sorted = sortConnectorsForManagement([
      connector({ id: 'healthy', name: 'Healthy' }),
      connector({ id: 'acl', name: 'Access', last_error: 'ACL mapping required' }),
      connector({ id: 'held', name: 'Held', health: { documents_needing_attention: 2 } }),
      connector({ id: 'auth', name: 'Authorize', authorized: false }),
    ])

    expect(sorted.map(item => item.id)).toEqual(['auth', 'held', 'acl', 'healthy'])
    expect(connectorPriority(sorted[0])).toBeLessThan(connectorPriority(sorted[3]))
  })
})

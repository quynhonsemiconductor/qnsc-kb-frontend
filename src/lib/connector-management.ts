export type ConnectorManagementState = 'healthy' | 'attention' | 'needs_action'
export type ConnectorManagementFilter = 'action' | 'connected' | 'all'
export type ConnectorNextAction = 'authorize' | 'retry_held' | 'review_access' | 'choose_locations' | 'sync'

export type ManageableConnector = {
  id: string
  name: string
  authorized?: boolean
  status: string
  last_error?: string
  last_sync?: string
  system: string
  health?: {
    documents_needing_attention?: number
    scopes?: { full_sync_required: boolean; cursor_status: string }[]
  }
}

export function getConnectorManagementState(item: ManageableConnector): ConnectorManagementState {
  if (!item.authorized) return 'needs_action'
  const held = Number(item.health?.documents_needing_attention || 0)
  const reconciliationPending = item.health?.scopes?.some(scope => scope.full_sync_required || scope.cursor_status !== 'ready')
  if (item.status === 'error' || item.last_error || held > 0 || reconciliationPending) return 'attention'
  return 'healthy'
}

export function getConnectorNextAction(item: ManageableConnector): ConnectorNextAction {
  if (!item.authorized) return 'authorize'
  if (Number(item.health?.documents_needing_attention || 0) > 0) return 'retry_held'
  if (/\b(acl|principal|permission|access)\b/i.test(item.last_error || '')) return 'review_access'
  if (!item.last_sync) return 'choose_locations'
  return 'sync'
}

export function connectorNeedsAction(item: ManageableConnector): boolean {
  return getConnectorManagementState(item) !== 'healthy'
}

export function matchesConnectorFilter(item: ManageableConnector, filter: ConnectorManagementFilter): boolean {
  if (filter === 'action') return connectorNeedsAction(item)
  if (filter === 'connected') return Boolean(item.authorized)
  return true
}

export function connectorPriority(item: ManageableConnector): number {
  const action = getConnectorNextAction(item)
  if (action === 'authorize') return 0
  if (action === 'retry_held') return 1
  if (action === 'review_access') return 2
  if (getConnectorManagementState(item) === 'attention') return 3
  if (action === 'choose_locations') return 4
  return 5
}

export function sortConnectorsForManagement<T extends ManageableConnector>(items: T[]): T[] {
  return [...items].sort((left, right) => connectorPriority(left) - connectorPriority(right) || left.name.localeCompare(right.name))
}

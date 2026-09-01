import client from './client'

export type ConnectorAclPrincipal = {
  principal_type: string
  principal_id: string
  principal_name?: string | null
  roles: string[]
  mapping_status: 'mapped' | 'unmapped'
  /** Server-owned: whether this principal may be mapped to a department. */
  mappable?: boolean
  department_id?: string | null
  department_name?: string | null
  internal_user_id?: string | null
}

/** A source provider this deployment declares, and whether it can be used. */
export type ConnectorProvider = {
  system: string
  available: boolean
  /** Setting names an operator must supply before `available` turns true. */
  missing_settings: string[]
}

export async function listConnectorProviders(): Promise<ConnectorProvider[]> {
  return (await client.get('/connectors/providers')).data
}

export async function listConnectors() { return (await client.get('/connectors')).data }
export async function createConnector(data: { name: string; system: string; path?: string; config?: Record<string, unknown> }) { return (await client.post('/connectors', data)).data }
export async function syncConnector(id: string) { return (await client.post(`/connectors/${id}/sync`)).data }
export async function listConnectorJobs(id: string, limit = 10) { return (await client.get(`/connectors/${id}/jobs`, { params: { limit } })).data }
export async function getConnectorHealth(id: string) { return (await client.get(`/connectors/${id}/health`)).data }
export async function retryFailedDocuments(id: string) { return (await client.post(`/connectors/${id}/retry-failed`)).data }
export async function getConnectorSourceTree(id: string) { return (await client.get(`/connectors/${id}/source-tree`)).data }
export async function getConnectorReadme(id: string) { return (await client.get(`/connectors/${id}/readme`)).data }
export async function updateConnector(id: string, data: { sync_mode?: string; department_ids?: string[] }) { return (await client.patch(`/connectors/${id}`, data)).data }
export async function startConnectorOAuth(id: string) { return (await client.get(`/connectors/${id}/oauth/start`)).data }
export async function listConnectorScopes(id: string) { return (await client.get(`/connectors/${id}/scopes`)).data }
export async function selectConnectorScopes(id: string, scope_ids: string[]) { return (await client.put(`/connectors/${id}/scopes`, { scope_ids })).data }
export async function previewConnector(id: string, limit = 50) { return (await client.get(`/connectors/${id}/preview`, { params: { limit } })).data }
export async function subscribeConnectorWebhooks(id: string) { return (await client.post(`/connectors/${id}/webhooks/subscribe`)).data }
export async function listConnectorAclPrincipals(id: string): Promise<ConnectorAclPrincipal[]> { return (await client.get(`/connectors/${id}/acl-principals`)).data }
export async function setConnectorPrincipalMapping(id: string, principalId: string, data: { department_id: string; principal_type: string; principal_name?: string }) { return (await client.put(`/connectors/${id}/principal-mappings/${encodeURIComponent(principalId)}`, data)).data }

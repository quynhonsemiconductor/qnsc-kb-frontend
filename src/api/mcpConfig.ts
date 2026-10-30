import client from './client'

export type McpConfig = {
  configured: boolean
  version: number
  content_md: string
  block: string
  sha256?: string
  updated_at?: string
}

export type McpConfigVersion = {
  version: number
  content_md: string
  updated_by: string | null
  created_at: string
}

/** Longest text the server accepts (src/domain/mcp_config.py MAX_CHARS). */
export const MCP_CONFIG_MAX_CHARS = 20_000

export async function getMcpConfig(): Promise<McpConfig> {
  return (await client.get('/mcp-config')).data
}

/** `expectedVersion` is the version the editor opened; the server refuses with 409 if it moved. */
export async function saveMcpConfig(contentMd: string, expectedVersion: number): Promise<McpConfig> {
  return (await client.put('/mcp-config', { content_md: contentMd, expected_version: expectedVersion })).data
}

export async function getMcpConfigHistory(): Promise<McpConfigVersion[]> {
  return (await client.get('/mcp-config/history')).data
}

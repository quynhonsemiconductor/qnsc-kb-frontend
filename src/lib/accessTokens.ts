/**
 * Pure helpers behind the access-token panel: what state a token is in, which lifetimes
 * the user may pick, and the exact text they paste into an MCP client.
 */
import type { AccessToken } from '../api/accessTokens'

export type TokenState = 'active' | 'expired' | 'revoked'

/** Revoked wins over expired: the owner's action is the more useful thing to show. */
export function tokenState(item: Pick<AccessToken, 'revoked' | 'expired'>): TokenState {
  if (item.revoked) return 'revoked'
  return item.expired ? 'expired' : 'active'
}

const LIFETIMES = [30, 90, 180, 365]

/** Offered lifetimes, never beyond what the server will accept. */
export function lifetimeOptions(maxDays: number): number[] {
  const allowed = LIFETIMES.filter(days => days <= maxDays)
  return allowed.length ? allowed : [Math.max(1, maxDays)]
}

/** Absolute URL of the MCP endpoint; the API base is relative in local development. */
export function mcpEndpoint(apiBase: string | undefined, endpointPath: string, origin: string): string {
  const base = new URL(apiBase || '/api/v1', origin)
  // endpoint_path is the full path from the server (/api/v1/mcp); keep only the origin of
  // the API base so a base like https://api.example.com/api/v1 does not double the prefix.
  return `${base.origin}${endpointPath}`
}

export function claudeCodeCommand(url: string, token: string): string {
  return `claude mcp add --transport http qnsc-kb ${url} --header "Authorization: Bearer ${token}"`
}

export function clientConfigJson(url: string, token: string): string {
  return JSON.stringify({
    mcpServers: {
      'qnsc-kb': { command: 'npx', args: ['mcp-remote', url, '--header', `Authorization: Bearer ${token}`] },
    },
  }, null, 2)
}

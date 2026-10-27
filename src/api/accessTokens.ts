import client from './client'

export type AccessTokenScope = 'read' | 'write'

export type AccessToken = {
  id: string
  name: string
  prefix: string
  scope: AccessTokenScope
  created_at: string
  expires_at: string
  last_used_at: string | null
  revoked: boolean
  expired: boolean
}

export type AccessTokenList = {
  items: AccessToken[]
  max_days: number
  max_tokens: number
  endpoint_path: string
}

/** The one response that carries the raw `token`; it is never returned again. */
export type CreatedAccessToken = AccessToken & { token: string }

export async function listAccessTokens() {
  return (await client.get('/auth/me/access-tokens')).data as AccessTokenList
}

export async function createAccessToken(body: { name: string; scope: AccessTokenScope; expires_in_days: number }) {
  return (await client.post('/auth/me/access-tokens', body)).data as CreatedAccessToken
}

export async function revokeAccessToken(id: string) {
  await client.delete(`/auth/me/access-tokens/${id}`)
}

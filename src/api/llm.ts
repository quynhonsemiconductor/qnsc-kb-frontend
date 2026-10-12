import client from './client'

export type LLMProvider = 'openai' | 'glm' | 'groq' | 'gemini' | 'custom'

export type LLMConfig = {
  configured: boolean
  source: 'admin' | 'none'
  enabled: boolean
  provider: LLMProvider
  model: string
  base_url: string
  allow_custom_base_url: boolean
  api_key_configured: boolean
  api_key_hint?: string | null
}

export type LLMConfigCandidate = {
  provider: LLMProvider
  model: string
  base_url: string
  api_key?: string
}

export type LLMTestResult = {
  ok: true
  provider: LLMProvider
  model: string
  latency_ms: number
  verification_token: string
  message?: string
}

export async function getLLMConfig() {
  return (await client.get<LLMConfig>('/admin/llm/config')).data
}

export async function testLLMConfig(data: LLMConfigCandidate) {
  return (await client.post<LLMTestResult>('/admin/llm/test', data)).data
}

export async function updateLLMConfig(data: LLMConfigCandidate & {
  enabled: boolean
  verification_token?: string
}) {
  return (await client.put<LLMConfig>('/admin/llm/config', data)).data
}

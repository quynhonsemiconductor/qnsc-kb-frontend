import client, { clearExpiredSession, getAccessToken, refreshSession } from './client'

export async function askAI(
  question: string,
  conversation_id?: string,
  language: 'en' | 'vi' = 'vi',
  articleId?: string,
  confirmEdit = false,
  editInstruction?: string,
) {
  const response = await client.post('/ai/ask', {
    question,
    conversation_id,
    language,
    article_id: articleId,
    confirm_edit: confirmEdit,
    edit_instruction: editInstruction || undefined,
  })
  return response.data
}

export async function askAIStream(
  question: string,
  conversationId: string | undefined,
  language: 'en' | 'vi',
  onToken: (content: string) => void,
  onSources: (sources: any[]) => void,
  onDone: (data: any) => void,
  articleId?: string,
  signal?: AbortSignal,
  retry = true,
  confirmEdit = false,
  editInstruction?: string,
) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  const token = getAccessToken()
  const response = await fetch(`${baseUrl}/ai/ask/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    // The refresh token is httpOnly. Keep the cookie on this fetch path just
    // as Axios does, otherwise a cross-origin deployment cannot recover a
    // streamed request after the short-lived access token expires.
    credentials: 'include',
    body: JSON.stringify({ question, conversation_id: conversationId, language, article_id: articleId || undefined, confirm_edit: confirmEdit, edit_instruction: editInstruction || undefined }),
    signal,
  })
  if (response.status === 401 && retry && await refreshSession()) {
    return askAIStream(question, conversationId, language, onToken, onSources, onDone, articleId, signal, false, confirmEdit, editInstruction)
  }
  if (response.status === 401) clearExpiredSession()
  if (!response.ok || !response.body) throw new Error(`AI stream failed (${response.status})`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  // Dispatch a single SSE event; malformed payloads are skipped so one bad
  // event cannot kill the whole stream.
  const dispatchEvent = (event: string) => {
    const line = event.split('\n').find((item) => item.startsWith('data: '))
    if (!line) return
    let payload: any
    try {
      payload = JSON.parse(line.slice(6))
    } catch {
      return
    }
    if (payload.type === 'token') onToken(payload.content || '')
    if (payload.type === 'replace') onToken(`\u0000REPLACE\u0000${payload.content || ''}`)
    if (payload.type === 'sources') onSources(payload.sources || [])
    if (payload.type === 'error') throw new Error(payload.detail || 'AI generation failed')
    if (payload.type === 'done') onDone(payload)
  }
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('The request was aborted', 'AbortError')
      const { value, done } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''
      for (const event of events) dispatchEvent(event)
      if (done) break
    }
    // Process a final event if the server closed immediately after writing it.
    if (buffer.trim()) dispatchEvent(buffer)
  } finally {
    // Close the underlying stream when we exit early (abort or error).
    void reader.cancel().catch(() => undefined)
  }
}

export async function getConversations() {
  const response = await client.get('/ai/conversations')
  return response.data
}

export async function createConversation(title?: string) {
  const response = await client.post('/ai/conversations', title ? { title } : {})
  return response.data
}

export async function getConversationMessages(id: string) {
  const response = await client.get(`/ai/conversations/${id}/messages`)
  return response.data
}

export async function deleteConversation(id: string) {
  await client.delete(`/ai/conversations/${id}`)
}

export async function renameConversation(id: string, title: string) {
  const response = await client.patch(`/ai/conversations/${id}`, { title })
  return response.data
}

export async function downloadArticleSource(articleId: string) {
  const response = await client.get(`/articles/${articleId}/source`, { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}

export async function submitAIFeedback(data: { ai_usage_log_id: string; rating: number; comment?: string }) {
  const response = await client.post('/ai/feedback', data)
  return response.data
}

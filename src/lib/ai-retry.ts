export interface RetryHistoryMessage {
  role: string
  content: string
  failed?: boolean
}

export interface RetryableMessageState {
  id?: string
  text: string
  citations?: unknown[]
  failed?: boolean
  retryQuestion?: string
  answerGrounded?: string
  answerExtended?: string
  hasExtended?: boolean
  logId?: string
  feedbackSubmitted?: boolean
  action?: string
  articleId?: string
  articleTitle?: string
  articlePreview?: string
  originalInformation?: string
  willUpdate?: string
  editInstruction?: string
  clarificationOptions?: string[]
  confidence?: string
  analyticsResults?: unknown[]
  evidenceStatus?: unknown
  unverifiedClaims?: unknown[]
}

/** How hard an answer looks: quick skips follow-up retrieval, thorough allows more of it. */
export type AskDepth = 'quick' | 'standard' | 'thorough'

interface AIAskPayloadOptions {
  question: string
  conversationId?: string
  language: 'en' | 'vi'
  articleId?: string
  confirmEdit?: boolean
  editInstruction?: string
  retryFailed?: boolean
  depth?: AskDepth
}

export function buildAIAskPayload({
  question,
  conversationId,
  language,
  articleId,
  confirmEdit = false,
  editInstruction,
  retryFailed = false,
  depth = 'standard',
}: AIAskPayloadOptions) {
  return {
    question,
    conversation_id: conversationId,
    language,
    article_id: articleId || undefined,
    confirm_edit: confirmEdit,
    edit_instruction: editInstruction || undefined,
    retry_failed: retryFailed,
    // The server's default is standard, so only a different choice is sent.
    depth: depth === 'standard' ? undefined : depth,
  }
}

const sameQuestion = (left: string, right: string) => left.trim() === right.trim()

/** Reset one failed assistant bubble before streaming the retry into that same bubble. */
export function resetFailedMessageForRetry<T extends RetryableMessageState>(
  message: T,
  question: string,
): T {
  return {
    ...message,
    text: '',
    citations: [],
    answerGrounded: undefined,
    answerExtended: undefined,
    hasExtended: undefined,
    logId: undefined,
    feedbackSubmitted: false,
    failed: false,
    retryQuestion: question,
    action: undefined,
    articleId: undefined,
    articleTitle: undefined,
    articlePreview: undefined,
    originalInformation: undefined,
    willUpdate: undefined,
    editInstruction: undefined,
    clarificationOptions: undefined,
    confidence: undefined,
    analyticsResults: [],
    evidenceStatus: undefined,
    unverifiedClaims: undefined,
  }
}

/**
 * Collapse adjacent legacy retry attempts that duplicated a failed turn.
 *
 * Only a previously failed pair is replaceable. Two successful, identical questions are
 * retained because they may be intentional; a failed attempt followed by either another
 * failure or a success is one logical turn and keeps only the newest result.
 */
export function collapseDuplicateFailedRetries<T extends RetryHistoryMessage>(history: T[]): T[] {
  const collapsed: T[] = []

  for (let index = 0; index < history.length; index += 1) {
    const userMessage = history[index]
    const assistantMessage = history[index + 1]
    const isTurn = userMessage.role === 'user' && assistantMessage?.role === 'assistant'

    if (!isTurn) {
      collapsed.push(userMessage)
      continue
    }

    const previousUser = collapsed[collapsed.length - 2]
    const previousAssistant = collapsed[collapsed.length - 1]
    const replacesFailedTurn = previousUser?.role === 'user'
      && previousAssistant?.role === 'assistant'
      && previousAssistant.failed === true
      && sameQuestion(previousUser.content, userMessage.content)

    if (replacesFailedTurn) collapsed.splice(-2, 2)
    collapsed.push(userMessage, assistantMessage)
    index += 1
  }

  return collapsed
}

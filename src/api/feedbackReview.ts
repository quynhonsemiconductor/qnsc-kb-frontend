import client from './client'

export type FeedbackReviewFilter = 'pending' | 'reviewed'

export type FeedbackItem = {
  id: string
  created_at: string
  user: string | null
  question: string
  answer: string
  comment: string | null
  retrieval_version: string
  reviewed_at: string | null
  review_note: string | null
}

export async function listFeedbackForReview(review: FeedbackReviewFilter = 'pending', limit = 50): Promise<FeedbackItem[]> {
  return (await client.get('/ai/feedback/review', { params: { review, limit } })).data
}

export async function markFeedbackReviewed(id: string, note = '') {
  return (await client.post(`/ai/feedback/${id}/review`, { note })).data
}

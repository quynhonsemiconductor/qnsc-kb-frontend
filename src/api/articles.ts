import client from './client'
import { fileNameFromContentDisposition } from '../utils/sourcePreview'
import type { EditPayloadRow } from '../lib/selectionEdit'

export async function getArticles(params: any = {}) {
  const response = await client.get('/articles', { params })
  return response.data
}

export async function getArticleChunks(id: string) { return (await client.get(`/articles/${id}/chunks`)).data }
export async function getArticle(id: string) {
  const response = await client.get(`/articles/${id}`)
  return response.data
}

export async function downloadArticleSource(id: string) {
  const response = await client.get(`/articles/${id}/source`, { responseType: 'blob' })
  const type = String(response.data?.type || response.headers?.['content-type'] || '').split(';')[0].trim()
  return { url: URL.createObjectURL(response.data), type }
}

export interface ArticleIndexSummary {
  pending: number
  processing: number
  ready: number
  failed: number
  total: number
  not_ready: number
}

/** How many published articles the AI can answer from, and how many are still being indexed. */
export async function getArticleIndexSummary(): Promise<ArticleIndexSummary> {
  const response = await client.get('/articles/index-summary')
  return response.data
}

/**
 * The stored original of an article, as a blob the page can render.
 *
 * Unlike `downloadArticleSource` this also returns the bytes and the file name the API sent,
 * because a Word or Excel file is identified by name (or, failing that, by its content) and
 * only then drawn by the page. The caller owns `url` and MUST revoke it.
 */
export async function downloadArticleSourceFile(id: string) {
  const response = await client.get(`/articles/${id}/source`, { responseType: 'blob' })
  const type = String(response.data?.type || response.headers?.['content-type'] || '').split(';')[0].trim()
  const name = fileNameFromContentDisposition(response.headers?.['content-disposition'])
  return { url: URL.createObjectURL(response.data), type, blob: response.data as Blob, name }
}

export interface SourceEditResult {
  id: string
  title: string
  status: string
  /** 'published' when the editor may approve their own change, else 'pending_approval'. */
  workflow: string
  message: string
  counts: number[]
  notes: string[]
  /** The article text could not be edited in place and was re-read from the corrected file. */
  text_regenerated: boolean
}

/** Where each find/replace would land in the stored original, without changing anything. */
export async function previewSourceEdit(id: string, replacements: EditPayloadRow[], version?: number) {
  const response = await client.post(`/articles/${id}/source-edits/preview`, { replacements, version })
  return response.data as { counts: number[]; notes: string[] }
}

/** Apply the changes to the original and submit the corrected file as a new version. */
export async function submitSourceEdit(id: string, replacements: EditPayloadRow[], version?: number) {
  const response = await client.post(`/articles/${id}/source-edits`, { replacements, version })
  return response.data as SourceEditResult
}

export async function downloadEvidencePreview(articleId: string, evidenceId: string) {
  const response = await client.get(`/articles/${articleId}/evidence/${evidenceId}/preview`, { responseType: 'blob' })
  const type = String(response.data?.type || response.headers?.['content-type'] || '').split(';')[0].trim()
  return { url: URL.createObjectURL(response.data), type }
}

/** Every row of a table the answer showed only the first rows of. */
export async function fetchEvidenceTable(articleId: string, evidenceId: string) {
  const response = await client.get(`/articles/${articleId}/evidence/${evidenceId}/preview`)
  return response.data as { columns?: unknown; rows?: unknown }
}

export async function getRelatedArticles(id: string, limit = 6) {
  const response = await client.get(`/articles/${id}/related`, { params: { limit } })
  return response.data
}

export async function createArticle(data: any) {
  const response = await client.post('/articles', data)
  return response.data
}

export async function updateArticle(id: string, data: any) {
  const response = await client.put(`/articles/${id}`, data)
  return response.data
}

export async function createArticleEditRequest(articleId: string, requestText: string) {
  const response = await client.post(`/articles/${articleId}/edit-requests`, { request_text: requestText })
  return response.data
}

export async function autoTagArticles(articleIds: string[]) {
  const response = await client.post('/articles/auto-tags', { article_ids: articleIds })
  return response.data
}

export async function confirmArticleTags(items: { article_id: string; tags: string[] }[]) {
  const response = await client.post('/articles/tags/confirm', { items })
  return response.data
}

export async function bulkReclassifyArticles(items: { article_id: string; type?: string; sensitivity?: string }[]) {
  const response = await client.post('/articles/bulk-reclassify', { items })
  return response.data as { changed: { article_id: string; type: string; sensitivity: string }[]; changed_count: number }
}

export type StructuredMetadata = { document_number: string | null; issue_date: string | null; expiry_date: string | null; signed_by: string | null }

export async function updateStructuredMetadata(id: string, metadata: Partial<StructuredMetadata>): Promise<StructuredMetadata> {
  const response = await client.put(`/articles/${id}/structured-metadata`, metadata)
  return response.data
}

export async function deleteArticle(id: string) {
  const response = await client.delete(`/articles/${id}`)
  return response.data
}

export async function getHistory(id: string) {
  const response = await client.get(`/articles/${id}/versions`)
  return response.data
}

export async function getVersionSnapshot(id: string, versionNum: number) {
  const response = await client.get(`/articles/${id}/versions/${versionNum}`)
  return response.data
}

export async function restoreArticleVersion(id: string, versionNum: number) {
  const response = await client.post(`/articles/${id}/versions/${versionNum}/restore`)
  return response.data
}

// Comments
export async function getComments(articleId: string) {
  const response = await client.get(`/interactions/articles/${articleId}/comments`)
  return response.data
}

export async function addComment(articleId: string, text: string) {
  const response = await client.post(`/interactions/articles/${articleId}/comments`, { text })
  return response.data
}

export async function deleteComment(commentId: string) {
  const response = await client.delete(`/interactions/comments/${commentId}`)
  return response.data
}

// Votes
export async function castVote(articleId: string, value: number) {
  const response = await client.post(`/interactions/articles/${articleId}/votes`, { value })
  return response.data
}

export async function getVotesSummary(articleId: string) {
  const response = await client.get(`/interactions/articles/${articleId}/votes`)
  return response.data
}

export async function getUserVote(articleId: string) {
  const response = await client.get(`/interactions/articles/${articleId}/user-vote`)
  return response.data
}

// Bookmarks
export async function bookmarkArticle(articleId: string) {
  const response = await client.post(`/interactions/articles/${articleId}/bookmark`)
  return response.data
}

export async function unbookmarkArticle(articleId: string) {
  const response = await client.delete(`/interactions/articles/${articleId}/bookmark`)
  return response.data
}

export async function getBookmarks() {
  const response = await client.get('/interactions/bookmarks')
  return response.data
}

export async function isBookmarked(articleId: string) {
  try {
    const bookmarks = await getBookmarks()
    return bookmarks.some((b: any) => b.id === articleId)
  } catch (err) {
    console.error(err)
    return false
  }
}

export async function getFollowStatus(articleId: string) {
  return (await client.get(`/articles/${articleId}/follow`)).data
}

export async function followArticle(articleId: string) {
  return (await client.post(`/articles/${articleId}/follow`)).data
}

export async function unfollowArticle(articleId: string) {
  return (await client.delete(`/articles/${articleId}/follow`)).data
}

import client from './client'

export async function getArticles(params: any = {}) {
  const response = await client.get('/articles', { params })
  return response.data
}

export async function getArticle(id: string) {
  const response = await client.get(`/articles/${id}`)
  return response.data
}

export async function downloadArticleSource(id: string) {
  const response = await client.get(`/articles/${id}/source`, { responseType: 'blob' })
  return URL.createObjectURL(response.data)
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

export async function isBookmarked(userId: string, articleId: string) {
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

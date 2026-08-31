import client from './client'

// `signal` is threaded through because search is submitted repeatedly from one screen and
// responses can land out of order: without cancellation a slow earlier query resolving last
// overwrites the results of the query the user is actually looking at.
export async function search(params: {
  q: string
  dept?: string
  tag?: string
  status?: string
  date_from?: string
  date_to?: string
  limit?: number
}, signal?: AbortSignal) {
  const response = await client.get('/search', { params, signal })
  return response.data
}

// Meta queries placed here for search/browse synergy
export async function getTags() {
  const response = await client.get('/meta/tags')
  return response.data
}

export type TagCatalogItem = {
  id: string
  tag: string
  normalized_tag: string
  active: boolean
  deprecated_at?: string | null
}

export async function getTagCatalog(): Promise<TagCatalogItem[]> {
  const response = await client.get('/meta/tag-catalog')
  return response.data
}

export async function createTagCatalogItem(tag: string): Promise<TagCatalogItem> {
  const response = await client.post('/meta/tag-catalog', { tag })
  return response.data
}

export async function deprecateTagCatalogItem(id: string) {
  await client.delete(`/meta/tag-catalog/${id}`)
}

export async function getGlossary() {
  const response = await client.get('/meta/glossary')
  return response.data
}

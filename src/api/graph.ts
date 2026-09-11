import client from './client'

export type GraphEntity = {
  id: string
  name: string
  type: string
  description: string | null
  mention_count: number
}

export type GraphRelationship = {
  id: string
  source_entity_id: string
  target_entity_id: string
  relation: string
  description: string | null
  article_id: string | null
}

export type GraphEntityDetail = GraphEntity & {
  relationships: (GraphRelationship & {
    other_entity: GraphEntity | null
    direction: 'incoming' | 'outgoing'
  })[]
  articles: { id: string; title: string; status: string }[]
}

export async function listGraphEntities(params: { q?: string; type?: string; limit?: number; offset?: number }): Promise<GraphEntity[]> {
  const response = await client.get('/graph/entities', { params })
  return response.data
}

export async function getGraphEntity(id: string): Promise<GraphEntityDetail> {
  const response = await client.get(`/graph/entities/${id}`)
  return response.data
}

export async function getGraphNeighbors(id: string, depth = 1): Promise<{ entities: GraphEntity[]; relationships: GraphRelationship[] }> {
  const response = await client.get(`/graph/entities/${id}/neighbors`, { params: { depth } })
  return response.data
}

export async function reprocessGraph(): Promise<{ processed: number; remaining_at_least: number }> {
  const response = await client.post('/graph/reprocess')
  return response.data
}

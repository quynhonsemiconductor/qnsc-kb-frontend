import client from './client'
import type { BrowseResponse } from '../types/search'
import type { HomeSummary } from '../types/governance'
import type { SourceResponse } from '../types/knowledge'

export async function getHomeSummary(): Promise<HomeSummary> { return (await client.get('/knowledge/home')).data }
export type KnowledgePageParams = { dept?: string; topic?: string; q?: string; limit?: number; offset?: number }
export async function browseKnowledge(params: KnowledgePageParams = {}): Promise<BrowseResponse> { return (await client.get('/knowledge/browse', { params })).data }
export type KnowledgeCatalogItem = { name: string; count: number }
export type KnowledgeCatalogResponse = { total: number; departments: KnowledgeCatalogItem[]; topics: KnowledgeCatalogItem[] }
export async function getKnowledgeCatalog(params: Pick<KnowledgePageParams, 'dept' | 'q'> = {}): Promise<KnowledgeCatalogResponse> { return (await client.get('/knowledge/catalog', { params })).data }
export type SourcePageParams = { q?: string; source_system?: string; limit?: number; offset?: number }
export async function getSources(params: SourcePageParams = {}): Promise<SourceResponse> { return (await client.get('/knowledge/sources', { params })).data }
export async function requestContent(query: string, dept?: string) { return (await client.post('/knowledge/content-requests', { query, dept })).data }
export async function createRolePreview(role: string, dept?: string) { return (await client.post('/knowledge/role-preview', { role, dept })).data }
export async function getCoverage() { return (await client.get('/knowledge/coverage')).data }
export async function getConflicts() { return (await client.get('/knowledge/conflicts')).data }
export async function resolveConflict(id: string, note: string) { return (await client.post(`/knowledge/conflicts/${id}/resolve`, { note })).data }

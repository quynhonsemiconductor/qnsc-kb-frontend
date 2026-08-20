import type { ArticleCard } from './article'

export interface SourceRecord { id: string; article_id: string; article_title: string; source_system: string; source_ref: string; filename?: string | null; mime_type?: string | null; ingested_at?: string; has_file: boolean; source_changed?: boolean }
export interface SourceResponse { sources: SourceRecord[]; total: number; limit: number; offset: number }
export interface KnowledgeBrowse { articles: ArticleCard[] }

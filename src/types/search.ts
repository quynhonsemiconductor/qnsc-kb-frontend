export interface SearchResult { id: string; title: string; snippet?: string; score?: number; article_id?: string; [key: string]: unknown }
export interface BrowseResponse { articles: import('./article').ArticleCard[]; total: number; limit: number; offset: number }

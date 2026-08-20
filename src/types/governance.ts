export interface HomeSummary { total_articles: number; departments: number; with_owner_percent: number; needs_review: number; pending_drafts: number; overdue_drafts?: number; open_gaps: number; recent: import('./article').ArticleCard[] }
export interface Gap { id: string; query: string; count: number; dept?: string | null; status: string }

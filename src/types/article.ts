export interface ArticleCard {
  id: string; title: string; dept: string; company_domain?: string; departments?: { id: string; name: string }[]; status: string; language: string; version: number
  owner?: string | null; owner_id?: string | null; tags: string[]; related_article_ids: string[]
  next_review?: string | null; last_reviewed?: string | null; needs_update: boolean; self_approved?: boolean
  source_count: number
}

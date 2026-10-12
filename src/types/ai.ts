export type EvidenceKind = 'table' | 'figure' | 'page_visual'

export interface EvidenceTable {
  columns: string[]
  rows: Array<Array<string | number | null>>
  total_rows?: number
  truncated?: boolean
}

export interface Citation {
  source_id?: string
  source_index?: number
  article_id: string
  title: string
  source_ref?: string
  section_ref?: string
  excerpt?: string
  highlight_text?: string
  highlight_texts?: string[]
  page_number?: number
  source_url?: string
  evidence_id?: string
  evidence_kind?: EvidenceKind
  evidence_label?: string
  evidence_preview_url?: string
  evidence_table?: EvidenceTable
}

export interface AnalyticsOperand {
  label: string
  value: string | number
  row?: string | number
  column?: string
  unit?: string
}

export interface AnalyticsResult {
  operation: 'count' | 'sum' | 'average' | 'median' | 'min' | 'max' | 'difference' | 'percentage_change'
  result: string | number
  formula: string
  source_id: string
  evidence_id: string
  label?: string
  unit?: string
  operands?: AnalyticsOperand[]
  warnings?: string[]
  rows_used?: number
}

export interface EvidenceStatus {
  stage?: 'searching' | 'reading_evidence' | 'calculating' | 'answering'
  vision_used?: boolean
  fallback_reason?: string
}

// Populated only when the backend's CLAIM_VERIFICATION_ENABLED flag is on.
export interface UnverifiedClaim { sentence: string; source_id: string }

export interface AIAnswer {
  answer: string
  citations: Citation[]
  analytics_results?: AnalyticsResult[]
  evidence_status?: EvidenceStatus
  unverified_claims?: UnverifiedClaim[]
  [key: string]: unknown
}

export type AIStreamEvent =
  | { type: 'token' | 'replace'; content?: string }
  | { type: 'sources'; sources?: Citation[] }
  | { type: 'evidence_status'; status?: EvidenceStatus; stage?: EvidenceStatus['stage']; vision_used?: boolean; fallback_reason?: string }
  | ({ type: 'done' | 'analytics'; analytics_results?: AnalyticsResult[]; evidence_status?: EvidenceStatus } & Record<string, unknown>)
  | { type: 'error'; detail?: string }

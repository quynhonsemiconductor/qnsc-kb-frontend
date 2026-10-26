export type EvidenceKind = 'table' | 'figure' | 'page_visual'

export interface EvidenceTable {
  columns: string[]
  rows: Array<Array<string | number | null>>
  total_rows?: number
  truncated?: boolean
}

/**
 * A figure or table on the page a citation points at. The paragraph was what retrieval
 * matched; this is what sits beside it in the document.
 */
export interface PageEvidence {
  evidence_id: string
  kind: EvidenceKind
  label: string
  page_number?: number
  preview_url?: string
  table?: EvidenceTable | null
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
  page_evidence?: PageEvidence[]
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

/** One step of the agent's work on a question, as streamed (and stored) by the backend. */
export interface AgentStep {
  step: string
  status: 'running' | 'done' | 'skipped' | 'failed'
  detail?: string
  data?: Record<string, unknown>
  ms?: number
}

export interface ChartArtifact {
  type: 'chart'
  id: string
  chart_type: 'bar' | 'line' | 'pie'
  title: string
  x_label: string
  categories: string[]
  series: Array<{ name: string; values: Array<number | null> }>
  evidence_id: string
  source_id: string
  truncated?: boolean
  total_rows?: number
}

/** Rectangles are fractions (0-1) of the figure's width and height, from its top left. */
export interface FigureRegion { x: number; y: number; w: number; h: number; label: string }

export interface FigureArtifact {
  type: 'figure_annotation'
  id: string
  evidence_id: string
  article_id: string
  source_id: string
  title: string
  caption: string
  regions: FigureRegion[]
}

export type AgentArtifact = ChartArtifact | FigureArtifact

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
  | { type: 'step'; step: string; status: AgentStep['status']; detail?: string; data?: Record<string, unknown> }
  | { type: 'evidence_status'; status?: EvidenceStatus; stage?: EvidenceStatus['stage']; vision_used?: boolean; fallback_reason?: string }
  | ({ type: 'done' | 'analytics'; analytics_results?: AnalyticsResult[]; evidence_status?: EvidenceStatus } & Record<string, unknown>)
  | { type: 'error'; detail?: string }

export interface Citation { article_id: string; title?: string; section_ref?: string; page_number?: number; text?: string }
// Populated only when the backend's CLAIM_VERIFICATION_ENABLED flag is on (off by
// default) -- a cited, checkable sentence the entailment judge could not confirm against
// the source it cites. Absent, not an empty array, on any response the flag did not run
// for (a refusal, a cached replay), so treat it as "not checked" there, not "all clear".
export interface UnverifiedClaim { sentence: string; source_id: string }
export interface AIAnswer { answer: string; citations: Citation[]; unverified_claims?: UnverifiedClaim[]; [key: string]: unknown }

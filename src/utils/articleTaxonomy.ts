// Mirrors the backend's fixed vocabularies exactly (models/article.py, ArticleUpdate in
// api/routers/articles.py) — both are pattern-validated server-side, so a value typed
// here that drifts from the backend list would 422 rather than silently do nothing.
export const ARTICLE_TYPES = ['POLICY', 'SOP', 'DECISION', 'FAQ', 'RCA', 'HOWTO', 'PLAYBOOK', 'REFERENCE'] as const
export const SENSITIVITY_LEVELS = ['public', 'internal', 'confidential', 'restricted'] as const

export type ArticleType = (typeof ARTICLE_TYPES)[number]
export type SensitivityLevel = (typeof SENSITIVITY_LEVELS)[number]

import client from './client'

// The Investigate endpoints are read-only and described in the backend's
// src/domain/investigate.py. Timestamps are naive UTC strings; read them with parseApiDate.

export type Level = 'ok' | 'warning' | 'critical'

export interface WindowInfo {
  hours: number
  since: string
  until: string
  bucket_seconds: number
}

export interface RequestTotals {
  requests: number
  server_errors: number
  client_errors: number
  error_rate: number
  p50_ms: number | null
  p95_ms: number | null
  p99_ms: number | null
}

export interface RequestDelta {
  requests_pct: number | null
  /** Percentage POINTS, not percent: 0.5% to 1% is +0.5, not +100. */
  error_rate_pp: number | null
  p95_pct: number | null
}

export interface RequestPoint {
  t: string
  requests: number
  server_errors: number
  client_errors: number
  p95_ms: number | null
}

export interface FailureGroup {
  method: string
  path: string
  status_code: number
  error_type: string | null
  count: number
  first_seen: string | null
  last_seen: string | null
  sample_request_id: string | null
}

export interface SlowRoute {
  method: string
  path: string
  requests: number
  p95_ms: number | null
  avg_ms: number | null
  error_rate: number
}

export interface RequestsPayload {
  window: WindowInfo
  excludes: string[]
  retention_days: number
  current: RequestTotals
  previous: RequestTotals
  delta: RequestDelta
  /** Reason codes, turned into wording by the interface (`health.reason.*`). */
  verdict: { level: Level; reasons: string[] }
  series: RequestPoint[]
  failure_groups: FailureGroup[]
  slow_routes: SlowRoute[]
}

export interface AiTotals {
  requests: number
  tokens: number
  avg_latency_ms: number | null
  p95_latency_ms: number | null
  cache_hit_rate: number
}

export interface AiPayload {
  window: WindowInfo
  current: AiTotals
  previous: AiTotals
  delta: { requests_pct: number | null; tokens_pct: number | null; latency_pct: number | null }
  series: Array<{ t: string; requests: number; tokens: number; avg_latency_ms: number | null }>
  models: Array<{ model: string; requests: number; tokens: number; avg_latency_ms: number | null }>
}

export interface FailedArticle {
  article_id: string
  /** Null unless the reader may see titles across companies. */
  title: string | null
  dept: string | null
  error: string | null
  at: string | null
}

export interface PipelinePayload {
  generated_at: string
  indexing: {
    pending: number
    processing: number
    failed: number
    oldest_waiting_at: string | null
    failed_articles: FailedArticle[]
  }
  dead_letters: {
    total: number
    by_queue: Array<{ queue: string; count: number }>
    recent: Array<{ id: string; queue: string; error: string | null; at: string | null }>
  }
  outbox: { pending: number; processing: number; failed: number; dead: number; oldest_waiting_at: string | null }
  notifications: { pending: number; failed: number; dead: number }
  connector_jobs: {
    running: number
    failed_recent: number
    recent_failures: Array<{ id: string; connector: string; error: string | null; at: string | null }>
  }
  reprocess_jobs: { queued: number; running: number; failed: number }
  attention: { level: Level; codes: string[] }
}

export interface WorkerDiagnostics {
  verdict: string
  healthy: boolean
  detail: string
  job_mode: string
  worker_count: number
  workers: Array<{ name: string; queues: string[]; active_task_count: number; active_task_names: string[] }>
  queues: Array<{ name: string; depth: number | null; consumers: string[]; consumed: boolean }>
  total_queued: number | null
  queues_without_consumer: string[]
  queues_with_backlog_and_no_consumer: string[]
  broker_error: string | null
}

export interface RequestFailure {
  request_id: string
  at: string | null
  method: string
  path: string
  status_code: number
  duration_ms: number
  error_type: string | null
  error_detail: string | null
}

export interface RequestFailureQuery {
  requestId?: string
  route?: string
  method?: string
  errorType?: string
  minStatus?: number
  since?: string
  until?: string
  limit?: number
}

export async function getInvestigateRequests(windowHours: number): Promise<RequestsPayload> {
  return (await client.get('/governance/investigate/requests', { params: { window_hours: windowHours } })).data
}

export async function getInvestigateAi(windowHours: number): Promise<AiPayload> {
  return (await client.get('/governance/investigate/ai', { params: { window_hours: windowHours } })).data
}

export async function getInvestigatePipeline(): Promise<PipelinePayload> {
  return (await client.get('/governance/investigate/pipeline')).data
}

export async function getWorkerDiagnostics(): Promise<WorkerDiagnostics> {
  return (await client.get('/governance/worker-diagnostics')).data
}

export async function getRequestFailures(query: RequestFailureQuery): Promise<{ count: number; failures: RequestFailure[] }> {
  return (
    await client.get('/governance/request-failures', {
      params: {
        request_id: query.requestId || undefined,
        route: query.route || undefined,
        method: query.method || undefined,
        error_type: query.errorType || undefined,
        min_status: query.minStatus,
        since: query.since || undefined,
        until: query.until || undefined,
        limit: query.limit,
      },
    })
  ).data
}

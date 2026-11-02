import React from 'react'
import { Link } from 'react-router-dom'
import { Boxes, Cog, Database, Mail, Network, RefreshCcw, Server, Skull } from 'lucide-react'
import type { PipelinePayload, WorkerDiagnostics } from '../../api/investigate'
import { Badge } from '../ui/Badge'
import { useLanguage } from '../../i18n/LanguageProvider'
import { formatDateTime } from '../../lib/formatters'
import { formatCount, workerTone } from '../../lib/investigate'
import { Card, EmptyNote, StatCard } from './Primitives'

const TH = 'p-3 font-semibold'

export function WorkersPanel({ data }: { data: WorkerDiagnostics }) {
  const { t } = useLanguage()
  const tone = workerTone(data.verdict)
  const verdictLabel = t(`health.worker.verdict.${data.verdict}`)
  const detailKey = `health.worker.detail.${data.verdict}`
  // The server's own sentence is the fallback for a verdict this build does not know yet.
  const detail = t(detailKey) === detailKey ? data.detail : t(detailKey)
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={tone} dot size="md">{verdictLabel === `health.worker.verdict.${data.verdict}` ? data.verdict : verdictLabel}</Badge>
          <span className="text-body-sm text-muted-foreground">
            {t('health.worker.summary', { workers: data.worker_count, queued: data.total_queued === null ? '—' : formatCount(data.total_queued), mode: data.job_mode })}
          </span>
        </div>
        <p className="text-body-sm text-foreground">{detail}</p>
        {data.queues_with_backlog_and_no_consumer.length > 0 && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive-text">
            {t('health.worker.starved', { queues: data.queues_with_backlog_and_no_consumer.join(', ') })}
          </p>
        )}
        {data.broker_error && (
          <p className="break-words font-mono text-caption text-muted-foreground">{data.broker_error}</p>
        )}
      </Card>

      {data.queues.length > 0 && (
        <div className="glass-panel overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse text-left text-xs">
            <caption className="sr-only">{t('health.worker.queuesCaption')}</caption>
            <thead>
              <tr className="border-b border-border bg-surface-muted uppercase tracking-wider text-muted-foreground">
                <th scope="col" className={TH}>{t('health.worker.queue')}</th>
                <th scope="col" className={`${TH} text-right`}>{t('health.worker.depth')}</th>
                <th scope="col" className={TH}>{t('health.worker.consumers')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.queues.map((queue) => (
                <tr key={queue.name} className="hover:bg-surface-soft">
                  <td className="p-3 font-mono text-foreground">{queue.name}</td>
                  <td className={`p-3 text-right font-bold ${queue.depth ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {queue.depth === null ? t('health.unknown') : formatCount(queue.depth)}
                  </td>
                  <td className="p-3">
                    {queue.consumed ? (
                      <span className="text-muted-foreground">{t('health.worker.consumedBy', { count: queue.consumers.length })}</span>
                    ) : (
                      <Badge variant={queue.depth ? 'danger' : 'warning'} size="sm">{t('health.worker.noConsumer')}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.workers.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.workers.map((worker) => (
            <li key={worker.name}>
              <Card className="space-y-1.5">
                <div className="flex items-center gap-2 text-body-sm font-semibold text-foreground"><Server size={14} className="text-muted-foreground" />{worker.name}</div>
                <p className="text-caption text-muted-foreground">{t('health.worker.consumes', { queues: worker.queues.join(', ') || '—' })}</p>
                <p className="text-caption text-muted-foreground">
                  {worker.active_task_count === 0
                    ? t('health.worker.idle')
                    : t('health.worker.running', { count: worker.active_task_count, tasks: worker.active_task_names.join(', ') })}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Problems({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-body-sm font-bold text-foreground">{title}</h3>
      {children}
    </div>
  )
}

export function PipelinePanel({ data }: { data: PipelinePayload }) {
  const { t } = useLanguage()
  const bad = 'text-destructive-text'
  const ok = 'text-success-text'
  const tone = (count: number) => (count > 0 ? bad : ok)
  const since = (iso: string | null) => (iso ? t('health.pipeline.oldest', { when: formatDateTime(iso) }) : t('health.pipeline.nothingWaiting'))
  const deadQueues = data.dead_letters.by_queue.map((item) => `${item.queue} ${item.count}`).join(' · ')
  const noneFailing =
    data.indexing.failed_articles.length === 0 &&
    data.dead_letters.recent.length === 0 &&
    data.connector_jobs.recent_failures.length === 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={t('health.pipeline.indexing')}
          value={formatCount(data.indexing.failed)}
          valueClassName={tone(data.indexing.failed)}
          icon={<Database size={16} />}
          detail={
            <>
              {t('health.pipeline.indexingDetail', { pending: data.indexing.pending, processing: data.indexing.processing })}
              <br />
              {since(data.indexing.oldest_waiting_at)}
            </>
          }
        />
        <StatCard
          label={t('health.pipeline.deadLetters')}
          value={formatCount(data.dead_letters.total)}
          valueClassName={tone(data.dead_letters.total)}
          icon={<Skull size={16} />}
          detail={deadQueues || t('health.pipeline.none')}
        />
        <StatCard
          label={t('health.pipeline.outbox')}
          value={formatCount(data.outbox.dead + data.outbox.failed)}
          valueClassName={tone(data.outbox.dead + data.outbox.failed)}
          icon={<Network size={16} />}
          detail={
            <>
              {t('health.pipeline.outboxDetail', { dead: data.outbox.dead, failed: data.outbox.failed, pending: data.outbox.pending })}
              <br />
              {since(data.outbox.oldest_waiting_at)}
            </>
          }
        />
        <StatCard
          label={t('health.pipeline.mail')}
          value={formatCount(data.notifications.failed + data.notifications.dead)}
          valueClassName={tone(data.notifications.failed + data.notifications.dead)}
          icon={<Mail size={16} />}
          detail={t('health.pipeline.mailDetail', { dead: data.notifications.dead, failed: data.notifications.failed, pending: data.notifications.pending })}
        />
        <StatCard
          label={t('health.pipeline.connectors')}
          value={formatCount(data.connector_jobs.failed_recent)}
          valueClassName={tone(data.connector_jobs.failed_recent)}
          icon={<Cog size={16} />}
          detail={t('health.pipeline.connectorsDetail', { running: data.connector_jobs.running })}
        />
        <StatCard
          label={t('health.pipeline.reprocess')}
          value={formatCount(data.reprocess_jobs.failed)}
          valueClassName={tone(data.reprocess_jobs.failed)}
          icon={<RefreshCcw size={16} />}
          detail={t('health.pipeline.reprocessDetail', { running: data.reprocess_jobs.running, queued: data.reprocess_jobs.queued })}
        />
      </div>

      {noneFailing ? (
        <EmptyNote>{t('health.pipeline.clear')}</EmptyNote>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.indexing.failed_articles.length > 0 && (
            <Problems title={t('health.pipeline.failedArticles')}>
              <ul className="divide-y divide-border rounded-xl border border-border px-3">
                {data.indexing.failed_articles.map((article) => (
                  <li key={article.article_id} className="space-y-0.5 py-2.5 text-body-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Boxes size={14} className="shrink-0 text-muted-foreground" />
                      <Link to={`/articles/${article.article_id}`} className="min-w-0 break-words font-semibold text-foreground underline-offset-2 hover:text-primary-text hover:underline">
                        {article.title ?? article.article_id}
                      </Link>
                      {article.dept && <Badge size="sm">{article.dept}</Badge>}
                    </div>
                    {article.error && <p className="break-words text-caption text-destructive-text">{article.error}</p>}
                    <p className="text-caption text-muted-foreground">{formatDateTime(article.at)}</p>
                  </li>
                ))}
              </ul>
            </Problems>
          )}
          {data.dead_letters.recent.length > 0 && (
            <Problems title={t('health.pipeline.recentDeadLetters')}>
              <ul className="divide-y divide-border rounded-xl border border-border px-3">
                {data.dead_letters.recent.map((job) => (
                  <li key={job.id} className="space-y-0.5 py-2.5 text-body-sm">
                    <div className="flex items-center gap-2"><Badge size="sm">{job.queue}</Badge><span className="text-caption text-muted-foreground">{formatDateTime(job.at)}</span></div>
                    {job.error && <p className="break-words text-caption text-destructive-text">{job.error}</p>}
                  </li>
                ))}
              </ul>
            </Problems>
          )}
          {data.connector_jobs.recent_failures.length > 0 && (
            <Problems title={t('health.pipeline.connectorFailures')}>
              <ul className="divide-y divide-border rounded-xl border border-border px-3">
                {data.connector_jobs.recent_failures.map((job) => (
                  <li key={job.id} className="space-y-0.5 py-2.5 text-body-sm">
                    <div className="flex items-center gap-2"><span className="font-semibold text-foreground">{job.connector}</span><span className="text-caption text-muted-foreground">{formatDateTime(job.at)}</span></div>
                    {job.error && <p className="break-words text-caption text-destructive-text">{job.error}</p>}
                  </li>
                ))}
              </ul>
            </Problems>
          )}
        </div>
      )}
    </div>
  )
}

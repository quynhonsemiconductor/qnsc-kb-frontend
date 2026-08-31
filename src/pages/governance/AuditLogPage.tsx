import React, { useEffect, useState } from 'react'
import { ClipboardList, ShieldAlert, RefreshCw } from 'lucide-react'
import { getAuditLogs } from '../../api/governance'
import { useLanguage } from '../../i18n/LanguageProvider'
import PageHeader from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { formatDateTime } from '../../lib/formatters'

const PAGE_SIZE = 100

export default function AuditLogPage() {
  const { t } = useLanguage()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // A failed fetch used to leave `logs` empty and render "no audit logs recorded yet",
  // which tells a reader auditing the system that nothing happened. For a security trail
  // that reads as evidence of absence, so failure is tracked and reported as failure.
  const [failed, setFailed] = useState(false)
  const [offset, setOffset] = useState(0)
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const fetchLogs = async (nextOffset = offset) => {
    setLoading(true)
    try {
      const data = await getAuditLogs({
        userId,
        action,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      })
      setLogs(data)
      setOffset(nextOffset)
      setFailed(false)
    } catch (err) {
      console.error(err)
      // Cleared so a stale page of rows cannot sit under an error banner and read as
      // the complete current result.
      setLogs([])
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchLogs(0) }, [])

  // The endpoint answers with a plain array, so a short page is the only available signal
  // that the end has been reached.
  const hasMore = logs.length === PAGE_SIZE

  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow="Governance control" title="Audit trail" description="Append-only records for every create, update, delete, approval, and permission change." icon={ClipboardList} actions={<Button variant="secondary" size="sm" onClick={() => void fetchLogs()} icon={<RefreshCw size={15} />}>{t('audit.refresh')}</Button>} />

      <div className="glass-panel grid gap-3 rounded-2xl border border-border p-4 md:grid-cols-4">
        <Input label={t('audit.userId')} value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="UUID" />
        <Input label={t('audit.action')} value={action} onChange={(event) => setAction(event.target.value)} placeholder="approve, delete..." />
        <Input label={t('audit.from')} type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        <Input label={t('audit.to')} type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        <div className="md:col-span-4 justify-self-start">
          <Button variant="primary" size="sm" onClick={() => void fetchLogs(0)}>{t('audit.applyFilters')}</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500 mr-3" />
          <span>{t('audit.loading')}</span>
        </div>
      ) : failed ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2.5 font-medium">
            <ShieldAlert size={18} className="mt-px shrink-0" />
            {t('audit.loadFailed')}
          </span>
          <Button variant="danger" size="sm" onClick={() => void fetchLogs()} icon={<RefreshCw size={14} />}>{t('common.retry')}</Button>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center bg-slate-900/5 text-slate-500 text-xs">
          {t('audit.empty')}
        </div>
      ) : (
        <>
          <div className="glass-panel overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <th className="p-3.5 font-semibold">{t('audit.colUser')}</th>
                  <th className="p-3.5 font-semibold">{t('audit.colAction')}</th>
                  <th className="p-3.5 font-semibold">{t('audit.colTarget')}</th>
                  <th className="p-3.5 font-semibold">{t('audit.colReference')}</th>
                  <th className="p-3.5 font-semibold">{t('audit.colTimestamp')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-charcoal">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3.5 font-medium text-primary-foreground">{log.user?.name || t('audit.systemWorker')}</td>
                    <td className="p-3.5">
                      <Badge variant={
                        log.action === 'create' || log.action === 'approve'
                          ? 'success'
                          : log.action === 'delete' || log.action === 'reject'
                          ? 'danger'
                          : 'primary'
                      } size="sm" className="uppercase tracking-wide">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="p-3.5 uppercase font-semibold text-caption text-slate-400">{log.target_type}</td>
                    <td className="p-3.5 font-mono text-slate-500">{log.target_id || 'N/A'}</td>
                    <td className="p-3.5 text-slate-500">
                      {formatDateTime(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-body-sm text-muted-foreground">{t('audit.showing', { from: offset + 1, to: offset + logs.length })}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => void fetchLogs(Math.max(0, offset - PAGE_SIZE))}>{t('audit.previous')}</Button>
              <Button variant="secondary" size="sm" disabled={!hasMore} onClick={() => void fetchLogs(offset + PAGE_SIZE)}>{t('audit.next')}</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

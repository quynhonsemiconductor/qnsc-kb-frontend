import React, { useEffect, useState } from 'react'
import { ClipboardList, ShieldAlert, RefreshCw } from 'lucide-react'
import { getAuditLogs } from '../../api/governance'
import PageHeader from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { formatDateTime } from '../../lib/formatters'

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const data = await getAuditLogs({ userId, action, startTime: startTime || undefined, endTime: endTime || undefined })
      setLogs(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [])

  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow="Governance control" title="Audit trail" description="Append-only records for every create, update, delete, approval, and permission change." icon={ClipboardList} actions={<Button variant="secondary" size="sm" onClick={fetchLogs} icon={<RefreshCw size={15} />}>Refresh</Button>} />

      <div className="glass-panel grid gap-3 rounded-2xl border border-border p-4 md:grid-cols-4">
        <Input label="User ID" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="UUID" />
        <Input label="Action" value={action} onChange={(event) => setAction(event.target.value)} placeholder="approve, delete..." />
        <Input label="From" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        <Input label="To" type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        <div className="md:col-span-4 justify-self-start">
          <Button variant="primary" size="sm" onClick={fetchLogs}>Apply filters</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500 mr-3" />
          <span>Retrieving security records...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center bg-slate-900/5 text-slate-500 text-xs">
          No audit logs recorded yet.
        </div>
      ) : (
        <div className="glass-panel overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="p-3.5 font-semibold">User</th>
                <th className="p-3.5 font-semibold">Action</th>
                <th className="p-3.5 font-semibold">Target Entity</th>
                <th className="p-3.5 font-semibold">Entity Reference</th>
                <th className="p-3.5 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-charcoal">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-3.5 font-medium text-primary-foreground">{log.user?.name || 'System Worker'}</td>
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
      )}
    </div>
  )
}

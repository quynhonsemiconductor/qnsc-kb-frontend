import React, { useEffect, useState } from 'react'
import { ClipboardList, ShieldAlert, RefreshCw } from 'lucide-react'
import { getAuditLogs } from '../../api/governance'
import PageHeader from '../../components/ui/PageHeader'

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
      <PageHeader eyebrow="Governance control" title="Audit trail" description="Append-only records for every create, update, delete, approval, and permission change." icon={ClipboardList} actions={<button
          onClick={fetchLogs}
          className="mm-secondary flex items-center gap-2 px-3 py-2 text-xs font-semibold"
        >
          <RefreshCw size={15} /> Refresh
        </button>} />

      <div className="glass-panel grid gap-3 rounded-2xl border border-border p-4 md:grid-cols-4">
        <label className="text-xs text-slate-400">User ID
          <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="UUID" className="field mt-1 w-full" />
        </label>
        <label className="text-xs text-slate-400">Action
          <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="approve, delete..." className="field mt-1 w-full" />
        </label>
        <label className="text-xs text-slate-400">From
          <input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="field mt-1 w-full" />
        </label>
        <label className="text-xs text-slate-400">To
          <input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="field mt-1 w-full" />
        </label>
        <button onClick={fetchLogs} className="mm-primary justify-self-start px-4 py-2 text-xs font-semibold md:col-span-4">Apply filters</button>
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
                    <span className={`px-2 py-0.5 rounded text-caption font-bold uppercase tracking-wide border ${
                      log.action === 'create' || log.action === 'approve'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : log.action === 'delete' || log.action === 'reject'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : 'bg-brand-500/10 text-brand-400 border-brand-500/20'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3.5 uppercase font-semibold text-caption text-slate-400">{log.target_type}</td>
                  <td className="p-3.5 font-mono text-slate-500">{log.target_id || 'N/A'}</td>
                  <td className="p-3.5 text-slate-500">
                    {new Date(log.created_at).toLocaleString()}
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

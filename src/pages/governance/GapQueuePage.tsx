import React, { useEffect, useState } from 'react'
import { AlertCircle, UserPlus, Trash2, RefreshCw } from 'lucide-react'
import { getSearchGaps, assignSearchGap, dismissSearchGap } from '../../api/governance'
import { listDepartments } from '../../api/auth'
import { useAuth } from '../../auth/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import PageHeader from '../../components/ui/PageHeader'
import { Select } from '../../components/ui/Select'

export default function GapQueuePage() {
  const dialog = useDialog()
  const [gaps, setGaps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actingGapId, setActingGapId] = useState<string | null>(null)

  // Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedGap, setSelectedGap] = useState<any>(null)
  const [assignDept, setAssignDept] = useState('')
  const [departments, setDepartments] = useState<{ id: string; name: string; company_domain: string; active: boolean }[]>([])
  const { user } = useAuth()

  const fetchGaps = async () => {
    setLoading(true)
    try {
      const data = await getSearchGaps('open')
      setGaps(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGaps()
    void listDepartments().then(setDepartments).catch(() => setDepartments([]))
  }, [])

  const visibleDepartments = departments.filter(item => item.active && item.company_domain === (selectedGap?.company_domain || user?.company_domain))

  const handleAssignClick = (gap: any) => {
    setSelectedGap(gap)
    const gapDepartments = departments.filter(item => item.active && item.company_domain === gap.company_domain)
    setAssignDept(gapDepartments.find(item => item.name === user?.dept)?.name || gapDepartments[0]?.name || '')
    setShowAssignModal(true)
  }

  const handleConfirmAssign = async () => {
    if (!selectedGap) return
    setActingGapId(selectedGap.id)
    setShowAssignModal(false)
    try {
      await assignSearchGap(selectedGap.id, assignDept)
      setGaps(current => current.filter(g => g.id !== selectedGap.id))
    } catch (err) {
      console.error(err)
      await dialog.alert('Failed to assign gap', { title: 'Assignment failed' })
    } finally {
      setActingGapId(null)
      setSelectedGap(null)
    }
  }

  const handleDismiss = async (gapId: string) => {
    setActingGapId(gapId)
    try {
      await dismissSearchGap(gapId)
      setGaps(current => current.filter(g => g.id !== gapId))
    } catch (err) {
      console.error(err)
      await dialog.alert('Failed to dismiss gap', { title: 'Dismissal failed' })
    } finally {
      setActingGapId(null)
    }
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow="Knowledge operations" title="Search gaps" description="Queries yielding zero results, routed to teams for human resolution." icon={AlertCircle} actions={<button
          onClick={fetchGaps}
          className="mm-secondary flex items-center gap-2 px-3 py-2 text-xs font-semibold"
        >
          <RefreshCw size={15} /> Refresh
        </button>} />

      {loading ? (
        <div className="flex justify-center items-center h-48 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500 mr-3" />
          <span>Analyzing search log queries...</span>
        </div>
      ) : gaps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center bg-slate-900/5">
          <AlertCircle className="mx-auto text-slate-600 mb-3" size={40} />
          <h3 className="text-base font-semibold text-primary-foreground">No search gaps logged</h3>
          <p className="text-slate-500 text-xs mt-1">Excellent! All recent employee queries have successfully resolved to articles in the KB.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {gaps.map((gap) => (
            <div
              key={gap.id}
              className="glass-panel interactive-lift flex items-center justify-between gap-4 rounded-2xl border border-border p-5 shadow-sm"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-primary-foreground bg-slate-950 px-2.5 py-1 rounded-md border border-border">
                    "{gap.query}"
                  </span>
                  <span className="bg-brand-500/10 text-brand-400 border border-brand-500/10 px-2 py-0.5 rounded text-caption font-semibold">
                    Misses: {gap.count}
                  </span>
                </div>
                <p className="text-caption text-slate-500">First logged on {new Date(gap.created_at).toLocaleDateString()}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAssignClick(gap)}
                  disabled={actingGapId === gap.id}
                  className="px-3.5 py-2 bg-brand-600/10 hover:bg-brand-600 hover:text-primary-foreground border border-brand-500/20 text-brand-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <UserPlus size={14} />
                  <span>Assign</span>
                </button>
                <button
                  onClick={() => handleDismiss(gap.id)}
                  disabled={actingGapId === gap.id}
                  className="p-2 bg-slate-800/60 text-slate-400 border border-slate-800 rounded-lg hover:bg-rose-500/10 hover:text-rose-400 transition-all"
                  title="Dismiss Gap"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedGap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-primary-foreground">Assign Query Gap</h3>
            <p className="text-xs text-slate-400">Route this missing content request to a specific organizational department:</p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Department</label>
              <Select
                value={assignDept}
                onChange={(e) => setAssignDept(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-primary-foreground outline-none focus:border-brand-500"
              >
                <option value="">Select department</option>
                {visibleDepartments.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setSelectedGap(null)
                }}
                className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssign}
                disabled={!assignDept}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-primary-foreground rounded-lg shadow-lg shadow-brand-600/20 transition-all"
              >
                Confirm Route
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

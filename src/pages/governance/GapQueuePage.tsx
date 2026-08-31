import React, { useEffect, useState } from 'react'
import { AlertCircle, UserPlus, Trash2, RefreshCw } from 'lucide-react'
import { getSearchGaps, assignSearchGap, dismissSearchGap } from '../../api/governance'
import { listDepartments } from '../../api/auth'
import { useAuth } from '../../auth/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import { useLanguage } from '../../i18n/LanguageProvider'
import PageHeader from '../../components/ui/PageHeader'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { formatDay } from '../../lib/formatters'

export default function GapQueuePage() {
  const dialog = useDialog()
  const { t } = useLanguage()
  const [gaps, setGaps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // Without this, a failed fetch fell through to the "No search gaps logged / Excellent!"
  // empty state, congratulating the reader on a queue that was never actually read.
  const [failed, setFailed] = useState(false)
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
      setFailed(false)
    } catch (err) {
      console.error(err)
      setGaps([])
      setFailed(true)
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
      <PageHeader eyebrow="Knowledge operations" title="Search gaps" description="Queries yielding zero results, routed to teams for human resolution." icon={AlertCircle} actions={<Button variant="secondary" size="sm" onClick={fetchGaps} icon={<RefreshCw size={15} />}>Refresh</Button>} />

      {loading ? (
        <div className="flex justify-center items-center h-48 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500 mr-3" />
          <span>Analyzing search log queries...</span>
        </div>
      ) : failed ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2.5 font-medium">
            <AlertCircle size={18} className="mt-px shrink-0" />
            {t('gaps.loadFailed')}
          </span>
          <Button variant="danger" size="sm" onClick={fetchGaps} icon={<RefreshCw size={14} />}>{t('common.retry')}</Button>
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
                  <Badge variant="primary" size="sm">
                    Misses: {gap.count}
                  </Badge>
                </div>
                <p className="text-caption text-slate-500">First logged on {formatDay(gap.created_at)}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAssignClick(gap)}
                  disabled={actingGapId === gap.id}
                  icon={<UserPlus size={14} />}
                >
                  Assign
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismiss(gap.id)}
                  disabled={actingGapId === gap.id}
                  icon={<Trash2 size={14} />}
                  aria-label="Dismiss Gap"
                  className="hover:text-rose-400"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Modal */}
      <Modal open={showAssignModal && !!selectedGap} onClose={() => { setShowAssignModal(false); setSelectedGap(null) }} title="Assign Query Gap" size="sm">
            <p className="text-xs text-slate-400">Route this missing content request to a specific organizational department:</p>

            <div className="mt-5">
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

            <div className="flex justify-end gap-3 pt-5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowAssignModal(false)
                  setSelectedGap(null)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmAssign}
                disabled={!assignDept}
              >
                Confirm Route
              </Button>
            </div>
      </Modal>
    </div>
  )
}

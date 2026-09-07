import { useEffect, useState } from 'react'
import { Bot, Check, FlaskConical, Pencil, Play, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import {
  createApprovalRule,
  deleteApprovalRule,
  listApprovalRules,
  runApprovalAgent,
  updateApprovalRule,
  type ApprovalAgentRunResponse,
  type ApprovalRule,
  type ApprovalRulePayload,
} from '../../api/governance'
import { listConnectors } from '../../api/connectors'
import { useDialog } from '../../components/ui/DialogProvider'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { apiErrorDetail } from '../../lib/error-handler'

type Connector = { id: string; name: string }

const EMPTY_FORM: ApprovalRulePayload = {
  name: '',
  instruction: '',
  active: true,
  priority: 100,
  connector_id: null,
  dept: null,
  file_extensions: null,
  max_similarity_score: null,
  can_approve: false,
  can_reject: false,
}

function toFormFields(rule: ApprovalRulePayload) {
  return {
    name: rule.name,
    instruction: rule.instruction,
    active: rule.active ?? true,
    priority: rule.priority ?? 100,
    connector_id: rule.connector_id ?? '',
    dept: rule.dept ?? '',
    file_extensions: (rule.file_extensions || []).join(', '),
    max_similarity_score: rule.max_similarity_score == null ? '' : String(rule.max_similarity_score),
    can_approve: rule.can_approve ?? false,
    can_reject: rule.can_reject ?? false,
  }
}

type FormFields = ReturnType<typeof toFormFields>

function toPayload(fields: FormFields): ApprovalRulePayload {
  return {
    name: fields.name.trim(),
    instruction: fields.instruction.trim(),
    active: fields.active,
    priority: Number(fields.priority) || 0,
    connector_id: fields.connector_id || null,
    dept: fields.dept.trim() || null,
    file_extensions: fields.file_extensions.trim()
      ? fields.file_extensions.split(',').map(item => item.trim()).filter(Boolean)
      : null,
    max_similarity_score: fields.max_similarity_score === '' ? null : Number(fields.max_similarity_score),
    can_approve: fields.can_approve,
    can_reject: fields.can_reject,
  }
}

function RuleFields({ fields, onChange, connectors }: {
  fields: FormFields
  onChange: (next: FormFields) => void
  connectors: Connector[]
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Rule name" required maxLength={150} value={fields.name} onChange={event => onChange({ ...fields, name: event.target.value })} placeholder="Approve lecture material" />
        <Input label="Priority" type="number" min={0} max={10000} required value={fields.priority} onChange={event => onChange({ ...fields, priority: Number(event.target.value) })} hint="Lower runs first. The first matching rule decides; the rest are not consulted." />
      </div>
      <div className="space-y-1.5">
        <label className="block text-body font-medium text-foreground">Instruction to the model</label>
        <Textarea required maxLength={5000} rows={3} value={fields.instruction} onChange={event => onChange({ ...fields, instruction: event.target.value })} placeholder={'Approve lecture material that names its course. Reject anything containing personal data.'} />
        <p className="text-body-sm text-muted-foreground">Only this text and the document are sent to the model. Scoping below is enforced in code, not by the model's judgement.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="block text-body font-medium text-foreground">Connector (optional)</label>
          <Select value={fields.connector_id} onChange={event => onChange({ ...fields, connector_id: event.target.value })}>
            <option value="">Any connector</option>
            {connectors.map(connector => <option key={connector.id} value={connector.id}>{connector.name}</option>)}
          </Select>
        </div>
        <Input label="Department (optional)" maxLength={100} value={fields.dept} onChange={event => onChange({ ...fields, dept: event.target.value })} placeholder="Any department" />
        <Input label="Max similarity (optional)" type="number" min={0} max={1} step={0.01} value={fields.max_similarity_score} onChange={event => onChange({ ...fields, max_similarity_score: event.target.value })} hint="Rejects drafts with no measured score, rather than treating unmeasured as low." />
      </div>
      <Input label="File extensions (optional)" value={fields.file_extensions} onChange={event => onChange({ ...fields, file_extensions: event.target.value })} placeholder=".pdf, .docx" hint="Comma-separated. Leave blank for any file type." />
      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-border bg-surface p-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-border" checked={fields.active} onChange={event => onChange({ ...fields, active: event.target.checked })} /> Active</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-border" checked={fields.can_approve} onChange={event => onChange({ ...fields, can_approve: event.target.checked })} /> May approve</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-border" checked={fields.can_reject} onChange={event => onChange({ ...fields, can_reject: event.target.checked })} /> May reject</label>
        <p className="text-body-sm text-muted-foreground">Leave both unchecked to dry-run this rule: it will run and be audited, but never change a draft's status.</p>
      </div>
    </div>
  )
}

export default function ApprovalRulesPage() {
  const dialog = useDialog()
  const [rules, setRules] = useState<ApprovalRule[]>([])
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [createFields, setCreateFields] = useState<FormFields>(toFormFields(EMPTY_FORM))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<FormFields | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [dryRun, setDryRun] = useState(true)
  const [limit, setLimit] = useState('')
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<ApprovalAgentRunResponse | null>(null)
  const [runError, setRunError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [nextRules, nextConnectors] = await Promise.all([listApprovalRules(), listConnectors()])
      setRules(nextRules)
      setConnectors(nextConnectors)
      setError('')
    } catch (err: unknown) {
      setError(apiErrorDetail(err) || 'Could not load approval rules.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setActingId('create')
    setError('')
    try {
      const created = await createApprovalRule(toPayload(createFields))
      setRules(items => [...items, created].sort((a, b) => a.priority - b.priority))
      setCreateFields(toFormFields(EMPTY_FORM))
      setMessage(`Created "${created.name}".`)
    } catch (err: unknown) {
      setError(apiErrorDetail(err) || 'Could not create the rule.')
    } finally {
      setActingId(null)
    }
  }

  const save = async () => {
    if (!editingId || !editFields) return
    setActingId(editingId)
    setError('')
    try {
      const updated = await updateApprovalRule(editingId, toPayload(editFields))
      setRules(items => items.map(item => item.id === updated.id ? updated : item).sort((a, b) => a.priority - b.priority))
      setEditingId(null)
      setEditFields(null)
      setMessage(`Updated "${updated.name}".`)
    } catch (err: unknown) {
      setError(apiErrorDetail(err) || 'Could not update the rule.')
    } finally {
      setActingId(null)
    }
  }

  const remove = async (rule: ApprovalRule) => {
    if (!await dialog.confirm(`Delete "${rule.name}"? This cannot be undone.`, { title: 'Delete approval rule', confirmLabel: 'Delete', tone: 'danger' })) return
    setActingId(rule.id)
    try {
      await deleteApprovalRule(rule.id)
      setRules(items => items.filter(item => item.id !== rule.id))
      setMessage(`Deleted "${rule.name}".`)
    } catch (err: unknown) {
      setError(apiErrorDetail(err) || 'Could not delete the rule.')
    } finally {
      setActingId(null)
    }
  }

  const run = async () => {
    setRunning(true)
    setRunError('')
    setRunResult(null)
    try {
      setRunResult(await runApprovalAgent({ dry_run: dryRun, limit: limit ? Number(limit) : undefined }))
    } catch (err: unknown) {
      setRunError(apiErrorDetail(err) || 'Could not run the approval agent.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="page-shell page-stack text-foreground">
      <header className="page-hero glass-panel rounded-panel border border-border px-4 py-5 shadow-[0_14px_34px_rgb(var(--shadow)/.1)] sm:px-6 sm:py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-caption font-bold uppercase tracking-[.16em] text-muted-foreground">Governance / automation</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Approval rules</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Write down the judgement a reviewer would apply anyway. Scoping below is enforced in code; only the
              instruction is judged by the model. A rule with neither "may approve" nor "may reject" still runs and
              is audited, but never changes a draft — that is how a rule is safely introduced.
            </p>
          </div>
          <Bot className="text-info" size={28} />
        </div>
      </header>

      {(message || error) && (
        <div role="status" className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${error ? 'border-destructive/25 bg-destructive/10 text-destructive' : 'border-success/25 bg-success/10 text-success'}`}>
          <span>{error || message}</span>
          <Button variant="ghost" size="sm" type="button" aria-label="Dismiss" icon={<X size={15} />} onClick={() => { setMessage(''); setError('') }} />
        </div>
      )}

      <form onSubmit={create} className="rounded-2xl border border-primary/20 bg-card p-5 shadow-[0_10px_28px_rgb(var(--shadow)/.08)]">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Plus size={17} /></span>
          <div><h2 className="font-semibold">Add rule</h2><p className="text-xs text-muted-foreground">New rules default to no authority — a dry run until you grant one.</p></div>
        </div>
        <RuleFields fields={createFields} onChange={setCreateFields} connectors={connectors} />
        <Button type="submit" variant="primary" disabled={actingId === 'create'} loading={actingId === 'create'} icon={<Plus size={15} />} className="mt-4">
          {actingId === 'create' ? 'Adding…' : 'Add rule'}
        </Button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_28px_rgb(var(--shadow)/.08)]">
        <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
          <div><h2 className="font-semibold">Rules</h2><p className="mt-1 text-xs text-muted-foreground">Tried in priority order; the first that matches a draft is the one consulted.</p></div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />} />
        </header>
        {loading ? (
          <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">Loading rules…</div>
        ) : !rules.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No approval rules yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {rules.map(rule => (
              <article key={rule.id} className={`px-5 py-4 ${!rule.active ? 'opacity-65' : ''}`}>
                {editingId === rule.id && editFields ? (
                  <div className="grid gap-4">
                    <RuleFields fields={editFields} onChange={setEditFields} connectors={connectors} />
                    <div className="flex gap-2">
                      <Button type="button" variant="primary" size="sm" disabled={actingId === rule.id} loading={actingId === rule.id} onClick={() => void save()} icon={<Save size={14} />}>Save</Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => { setEditingId(null); setEditFields(null) }} icon={<X size={14} />}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{rule.name}</h3>
                        <Badge variant={rule.active ? 'success' : 'default'} size="sm">{rule.active ? 'Active' : 'Inactive'}</Badge>
                        <Badge variant="default" size="sm">Priority {rule.priority}</Badge>
                        {rule.can_approve && <Badge variant="success" size="sm">May approve</Badge>}
                        {rule.can_reject && <Badge variant="danger" size="sm">May reject</Badge>}
                        {!rule.can_approve && !rule.can_reject && <Badge variant="warning" size="sm">Dry run only</Badge>}
                      </div>
                      <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{rule.instruction}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Scope: {rule.connector_id ? (connectors.find(c => c.id === rule.connector_id)?.name || 'One connector') : 'Any connector'}
                        {' · '}{rule.dept || 'Any department'}
                        {' · '}{rule.file_extensions?.length ? rule.file_extensions.join(', ') : 'Any file type'}
                        {rule.max_similarity_score != null && ` · similarity ≤ ${rule.max_similarity_score}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => { setEditingId(rule.id); setEditFields(toFormFields(rule)) }} icon={<Pencil size={14} />}>Edit</Button>
                      <Button type="button" variant="danger" size="sm" disabled={actingId === rule.id} onClick={() => void remove(rule)} icon={<Trash2 size={14} />}>Delete</Button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_28px_rgb(var(--shadow)/.08)]">
        <header className="border-b border-border bg-surface px-5 py-4">
          <h2 className="font-semibold">Run the agent now</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The agent also runs automatically on a schedule against every company with an active rule. Use this to
            preview a rule before granting it authority, or to sweep the queue immediately.
          </p>
        </header>
        <div className="flex flex-wrap items-end gap-4 px-5 py-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-border" checked={dryRun} onChange={event => setDryRun(event.target.checked)} /> Dry run (decide, do not apply)</label>
          <Input label="Limit (optional)" type="number" min={1} max={500} value={limit} onChange={event => setLimit(event.target.value)} className="w-32" placeholder="50" />
          <Button type="button" variant="primary" disabled={running} loading={running} onClick={() => void run()} icon={dryRun ? <FlaskConical size={15} /> : <Play size={15} />}>
            {running ? 'Running…' : dryRun ? 'Preview' : 'Run for real'}
          </Button>
        </div>
        {runError && <div className="mx-5 mb-4 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{runError}</div>}
        {runResult && (
          <div className="border-t border-border px-5 py-4">
            {runResult.disabled ? (
              <p className="text-sm text-muted-foreground">The approval agent is disabled (APPROVAL_AGENT_ENABLED=false).</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default" size="sm">{runResult.evaluated} evaluated</Badge>
                  <Badge variant="success" size="sm">{runResult.approved} approved</Badge>
                  <Badge variant="danger" size="sm">{runResult.rejected} rejected</Badge>
                  <Badge variant="warning" size="sm">{runResult.left_for_review} left for review</Badge>
                </div>
                {!runResult.results.length ? (
                  <p className="mt-3 text-sm text-muted-foreground">No pending drafts matched an active rule.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-border">
                    {runResult.results.map(item => (
                      <li key={item.draft_id} className="flex items-start justify-between gap-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.title || item.draft_id}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.rule ? `Rule: ${item.rule} — ` : ''}{item.reason}</p>
                        </div>
                        <Badge variant={item.decision === 'approve' && item.applied ? 'success' : item.decision === 'reject' && item.applied ? 'danger' : 'default'} size="sm">
                          {item.applied ? (item.decision === 'approve' ? <Check size={11} /> : item.decision === 'reject' ? <X size={11} /> : null) : null}
                          {' '}{item.applied ? item.decision : 'left for review'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

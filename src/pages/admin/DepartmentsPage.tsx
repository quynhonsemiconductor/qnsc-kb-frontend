import { useEffect, useState } from 'react'
import { ArchiveRestore, Building2, Check, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import { createDepartment, deleteDepartment, listDepartments, updateDepartment } from '../../api/auth'
import { useAuth } from '../../auth/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'

type Department = {
  id: string; name: string; description: string; company_domain: string; active: boolean
  owner?: { id: string; name: string; email: string } | null
}

export default function DepartmentsPage() {
  const { user } = useAuth()
  const dialog = useDialog()
  const [departments, setDepartments] = useState<Department[]>([])
  const [form, setForm] = useState({ name: '', description: '' })
  const [editing, setEditing] = useState<Department | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try { setDepartments(await listDepartments()); setError('') }
    catch (err: any) { setError(err.response?.data?.detail || 'Could not load departments') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setActingId('create'); setError('')
    try {
      const created = await createDepartment(form)
      setDepartments(items => [...items, created].sort((a, b) => a.name.localeCompare(b.name)))
      setForm({ name: '', description: '' }); setMessage(`Created ${created.name}`)
    } catch (err: any) { setError(err.response?.data?.detail || 'Could not create department') }
    finally { setActingId(null) }
  }
  const save = async () => {
    if (!editing) return
    setActingId(editing.id); setError('')
    try {
      const updated = await updateDepartment(editing.id, { name: editing.name, description: editing.description })
      setDepartments(items => items.map(item => item.id === updated.id ? updated : item)); setEditing(null); setMessage(`Updated ${updated.name}`)
    } catch (err: any) { setError(err.response?.data?.detail || 'Could not update department') }
    finally { setActingId(null) }
  }
  const toggle = async (department: Department) => {
    setActingId(department.id)
    try {
      const updated = await updateDepartment(department.id, { active: !department.active })
      setDepartments(items => items.map(item => item.id === updated.id ? updated : item)); setMessage(`${updated.name} is now ${updated.active ? 'active' : 'inactive'}`)
    } catch (err: any) { setError(err.response?.data?.detail || 'Could not update department status') }
    finally { setActingId(null) }
  }
  const remove = async (department: Department) => {
    if (!await dialog.confirm(`Delete ${department.name}? Departments with users or content must be deactivated instead.`, { title: 'Delete department', confirmLabel: 'Delete', tone: 'danger' })) return
    setActingId(department.id)
    try { await deleteDepartment(department.id); setDepartments(items => items.filter(item => item.id !== department.id)); setMessage(`${department.name} was deleted`) }
    catch (err: any) { setError(err.response?.data?.detail || 'Could not delete department') }
    finally { setActingId(null) }
  }

  return <main className="page-shell page-stack text-foreground">
    <header className="page-hero glass-panel rounded-panel border border-border px-4 py-5 shadow-[0_14px_34px_rgb(var(--shadow)/.1)] sm:px-6 sm:py-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Administration / structure</p><h1 className="mt-2 text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Departments</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Descriptions make document routing explainable: split articles are matched against the work each department owns.</p></div><Building2 className="text-info" size={28} /></div>
    </header>
    {(message || error) && <div role="status" className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${error ? 'border-destructive/25 bg-destructive/10 text-destructive' : 'border-success/25 bg-success/10 text-success'}`}><span>{error || message}</span><button type="button" aria-label="Dismiss" onClick={() => { setMessage(''); setError('') }}><X size={15} /></button></div>}

    <form onSubmit={create} className="rounded-2xl border border-primary/20 bg-card p-5 shadow-[0_10px_28px_rgb(var(--shadow)/.08)]">
      <div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Plus size={17} /></span><div><h2 className="font-semibold">Add department</h2><p className="text-xs text-muted-foreground">A short description is required and will guide document suggestions.</p></div></div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.5fr)_auto]"><label><span className="label">Department name</span><input required maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Engineering" className="field w-full" /></label><label><span className="label">What it owns</span><input required minLength={10} maxLength={500} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Product engineering standards, release processes, and technical operations." className="field w-full" /><span className="mt-1 block text-[11px] text-muted-foreground">At least 10 characters.</span></label><button type="submit" disabled={actingId === 'create'} className="self-start mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"><Plus size={15} />{actingId === 'create' ? 'Adding…' : 'Add'}</button></div>
    </form>

    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_28px_rgb(var(--shadow)/.08)]"><header className="flex items-center justify-between border-b border-border bg-surface px-5 py-4"><div><h2 className="font-semibold">Department directory</h2><p className="mt-1 text-xs text-muted-foreground">Keep descriptions current so routing recommendations stay useful.</p></div><button type="button" onClick={() => void load()} className="grid h-9 w-9 place-items-center rounded-lg border border-border"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button></header>
      {loading ? <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">Loading departments…</div> : !departments.length ? <div className="p-10 text-center text-sm text-muted-foreground">No departments yet.</div> : <div className="divide-y divide-border">{departments.map(item => <article key={item.id} className={`flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between ${!item.active ? 'opacity-65' : ''}`}><div className="min-w-0 flex-1">{editing?.id === item.id ? <div className="grid gap-3"><input required value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} className="field max-w-md" /><textarea required minLength={10} maxLength={500} value={editing.description} onChange={event => setEditing({ ...editing, description: event.target.value })} className="field min-h-24 max-w-2xl" /></div> : <><div className="flex items-center gap-2"><h3 className="font-semibold">{item.name}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.active ? 'bg-success/10 text-success' : 'bg-muted/20 text-muted-foreground'}`}>{item.active ? 'Active' : 'Inactive'}</span></div><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{item.description || 'No description yet — add one to improve routing suggestions.'}</p><p className="mt-2 text-xs text-muted-foreground">Owner: <span className="font-semibold text-foreground">{item.owner?.name || 'Unassigned'}</span></p></>}</div><div className="flex shrink-0 flex-wrap gap-2">{editing?.id === item.id ? <><button type="button" disabled={actingId === item.id} onClick={() => void save()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Save size={14} /> Save</button><button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold"><X size={14} /> Cancel</button></> : <button type="button" onClick={() => setEditing({ ...item })} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold"><Pencil size={14} /> Edit</button>}<button type="button" disabled={actingId === item.id} onClick={() => void toggle(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold">{item.active ? <><ArchiveRestore size={14} /> Deactivate</> : <><Check size={14} /> Reactivate</>}</button><button type="button" disabled={actingId === item.id} onClick={() => void remove(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive"><Trash2 size={14} /> Delete</button></div></article>)}</div>}
    </section>
  </main>
}

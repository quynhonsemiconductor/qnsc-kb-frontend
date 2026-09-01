import { useEffect, useState } from 'react'
import { ArchiveRestore, Building2, Check, Pencil, Plus, RefreshCw, Save, Trash2, Users, X } from 'lucide-react'
import { createDepartment, deleteDepartment, listDepartmentMembers, listDepartments, listUsers, replaceDepartmentMembers, updateDepartment } from '../../api/auth'
import { useAuth } from '../../auth/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { apiErrorDetail } from '../../lib/error-handler'

type Department = {
  id: string; name: string; description: string; company_domain: string; active: boolean
  owner?: { id: string; name: string; email: string } | null
}
type ManagedUser = { id: string; name: string; email: string; company_domain: string; active: boolean }
type Member = { id: string; name: string; email: string; active: boolean }

export default function DepartmentsPage() {
  const { user } = useAuth()
  const dialog = useDialog()
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [members, setMembers] = useState<Record<string, Member[]>>({})
  const [membersOpenId, setMembersOpenId] = useState<string | null>(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [form, setForm] = useState({ name: '', description: '' })
  const [editing, setEditing] = useState<Department | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [nextDepartments, nextUsers] = await Promise.all([listDepartments(), listUsers()])
      setDepartments(nextDepartments)
      setUsers(nextUsers)
      const memberEntries = await Promise.all(
        nextDepartments.map(async (item: Department) => [item.id, await listDepartmentMembers(item.id)] as const),
      )
      setMembers(Object.fromEntries(memberEntries))
      setError('')
    }
    catch (err: unknown) { setError(apiErrorDetail(err) || 'Could not load departments') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setActingId('create'); setError('')
    try {
      const created = await createDepartment(form)
      setDepartments(items => [...items, created].sort((a, b) => a.name.localeCompare(b.name)))
      setForm({ name: '', description: '' }); setMessage(`Created ${created.name}`)
    } catch (err: unknown) { setError(apiErrorDetail(err) || 'Could not create department') }
    finally { setActingId(null) }
  }
  const save = async () => {
    if (!editing) return
    setActingId(editing.id); setError('')
    try {
      const updated = await updateDepartment(editing.id, { name: editing.name, description: editing.description })
      setDepartments(items => items.map(item => item.id === updated.id ? updated : item)); setEditing(null); setMessage(`Updated ${updated.name}`)
    } catch (err: unknown) { setError(apiErrorDetail(err) || 'Could not update department') }
    finally { setActingId(null) }
  }
  const toggle = async (department: Department) => {
    setActingId(department.id)
    try {
      const updated = await updateDepartment(department.id, { active: !department.active })
      setDepartments(items => items.map(item => item.id === updated.id ? updated : item)); setMessage(`${updated.name} is now ${updated.active ? 'active' : 'inactive'}`)
    } catch (err: unknown) { setError(apiErrorDetail(err) || 'Could not update department status') }
    finally { setActingId(null) }
  }
  const remove = async (department: Department) => {
    if (!await dialog.confirm(`Delete ${department.name}? Departments with users or content must be deactivated instead.`, { title: 'Delete department', confirmLabel: 'Delete', tone: 'danger' })) return
    setActingId(department.id)
    try { await deleteDepartment(department.id); setDepartments(items => items.filter(item => item.id !== department.id)); setMessage(`${department.name} was deleted`) }
    catch (err: unknown) { setError(apiErrorDetail(err) || 'Could not delete department') }
    finally { setActingId(null) }
  }
  const toggleMember = async (department: Department, member: ManagedUser) => {
    const current = members[department.id] || []
    const nextIds = current.some(item => item.id === member.id)
      ? current.filter(item => item.id !== member.id).map(item => item.id)
      : [...current.map(item => item.id), member.id]
    setActingId(`members:${department.id}`)
    try {
      await replaceDepartmentMembers(department.id, nextIds)
      setMembers(state => ({
        ...state,
        [department.id]: users
          .filter(item => nextIds.includes(item.id))
          .map(item => ({ id: item.id, name: item.name, email: item.email, active: item.active })),
      }))
      setMessage(`Updated members for ${department.name}`)
      setError('')
    }
    catch (err: unknown) { setError(apiErrorDetail(err) || 'Could not update department members') }
    finally { setActingId(null) }
  }

  return <div className="page-shell page-stack text-foreground">
    <header className="page-hero glass-panel rounded-panel border border-border px-4 py-5 shadow-[0_14px_34px_rgb(var(--shadow)/.1)] sm:px-6 sm:py-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-caption font-bold uppercase tracking-[.16em] text-muted-foreground">Administration / structure</p><h1 className="mt-2 text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Departments</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Descriptions make document routing explainable: split articles are matched against the work each department owns.</p></div><Building2 className="text-info" size={28} /></div>
    </header>
    {(message || error) && <div role="status" className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${error ? 'border-destructive/25 bg-destructive/10 text-destructive' : 'border-success/25 bg-success/10 text-success'}`}><span>{error || message}</span><Button variant="ghost" size="sm" type="button" aria-label="Dismiss" icon={<X size={15} />} onClick={() => { setMessage(''); setError('') }} /></div>}

    <form onSubmit={create} className="rounded-2xl border border-primary/20 bg-card p-5 shadow-[0_10px_28px_rgb(var(--shadow)/.08)]">
      <div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Plus size={17} /></span><div><h2 className="font-semibold">Add department</h2><p className="text-xs text-muted-foreground">A short description is required and will guide document suggestions.</p></div></div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.5fr)_auto]">
        <Input label="Department name" required maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Engineering" />
        <Input label="What it owns" required minLength={10} maxLength={500} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Product engineering standards, release processes, and technical operations." hint="At least 10 characters." />
        <Button type="submit" variant="primary" disabled={actingId === 'create'} loading={actingId === 'create'} icon={<Plus size={15} />} className="self-start mt-6">{actingId === 'create' ? 'Adding…' : 'Add'}</Button>
      </div>
    </form>

    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_28px_rgb(var(--shadow)/.08)]"><header className="flex items-center justify-between border-b border-border bg-surface px-5 py-4"><div><h2 className="font-semibold">Department directory</h2><p className="mt-1 text-xs text-muted-foreground">Keep descriptions current so routing recommendations stay useful.</p></div><Button type="button" variant="secondary" size="sm" onClick={() => void load()} icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />} /></header>
      {loading ? <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">Loading departments…</div> : !departments.length ? <div className="p-10 text-center text-sm text-muted-foreground">No departments yet.</div> : <div className="divide-y divide-border">{departments.map(item => { const departmentMembers = members[item.id] || []; const selectable = users.filter(candidate => candidate.company_domain === item.company_domain && (!memberQuery.trim() || `${candidate.name} ${candidate.email}`.toLowerCase().includes(memberQuery.trim().toLowerCase()))); return <article key={item.id} className={`px-5 py-4 ${!item.active ? 'opacity-65' : ''}`}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1">{editing?.id === item.id ? <div className="grid gap-3"><Input required value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} className="max-w-md" /><textarea required minLength={10} maxLength={500} value={editing.description} onChange={event => setEditing({ ...editing, description: event.target.value })} className="field min-h-24 max-w-2xl" /></div> : <><div className="flex items-center gap-2"><h3 className="font-semibold">{item.name}</h3><Badge variant={item.active ? 'success' : 'default'} size="sm">{item.active ? 'Active' : 'Inactive'}</Badge><Badge variant="default" size="sm">{departmentMembers.length} {departmentMembers.length === 1 ? 'member' : 'members'}</Badge></div><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{item.description || 'No description yet — add one to improve routing suggestions.'}</p><p className="mt-2 text-xs text-muted-foreground">Owner: <span className="font-semibold text-foreground">{item.owner?.name || 'Unassigned'}</span></p></>}</div><div className="flex shrink-0 flex-wrap gap-2">{editing?.id === item.id ? <><Button type="button" variant="primary" size="sm" disabled={actingId === item.id} onClick={() => void save()} icon={<Save size={14} />}>Save</Button><Button type="button" variant="secondary" size="sm" onClick={() => setEditing(null)} icon={<X size={14} />}>Cancel</Button></> : <Button type="button" variant="secondary" size="sm" onClick={() => setEditing({ ...item })} icon={<Pencil size={14} />}>Edit</Button>}<Button type="button" variant="secondary" size="sm" aria-expanded={membersOpenId === item.id} onClick={() => { setMembersOpenId(membersOpenId === item.id ? null : item.id); setMemberQuery('') }} icon={<Users size={14} />}>Members</Button><Button type="button" variant="secondary" size="sm" disabled={actingId === item.id} onClick={() => void toggle(item)} icon={item.active ? <ArchiveRestore size={14} /> : <Check size={14} />}>{item.active ? 'Deactivate' : 'Reactivate'}</Button><Button type="button" variant="danger" size="sm" disabled={actingId === item.id} onClick={() => void remove(item)} icon={<Trash2 size={14} />}>Delete</Button></div></div>{membersOpenId === item.id && <div className="mt-4 rounded-xl border border-border bg-surface p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="text-sm font-semibold">Department membership</h4><p className="mt-1 text-xs text-muted-foreground">Membership is the read audience: members can open articles published to {item.name}. Changes apply immediately.</p></div><div className="sm:w-64"><Input value={memberQuery} onChange={event => setMemberQuery(event.target.value)} placeholder="Find a person…" aria-label={`Filter people for ${item.name}`} /></div></div>{!selectable.length ? <p className="mt-3 text-xs text-muted-foreground">No matching people in {item.company_domain}.</p> : <ul className="mt-3 grid gap-1 sm:grid-cols-2">{selectable.map(candidate => { const isMember = departmentMembers.some(member => member.id === candidate.id); return <li key={candidate.id}><label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-card"><input type="checkbox" checked={isMember} disabled={actingId === `members:${item.id}`} onChange={() => void toggleMember(item, candidate)} className="h-4 w-4 rounded border-border" /><span className="min-w-0 flex-1 truncate"><span className="font-medium">{candidate.name}</span> <span className="text-xs text-muted-foreground">{candidate.email}</span></span>{!candidate.active && <Badge variant="default" size="sm">Inactive</Badge>}</label></li> })}</ul>}</div>}</article> })}</div>}
    </section>
  </div>
}

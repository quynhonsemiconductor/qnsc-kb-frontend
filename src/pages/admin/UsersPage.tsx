import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Check, ChevronDown, Mail, Plus, RefreshCw, Search, ShieldCheck, UserMinus, UserPlus, Users, X } from 'lucide-react'
import { assignCompanyCeo, createInvitation, deactivateUser, listDepartments, listInvitations, listRoles, listUsers, resendInvitation, revokeInvitation, updateUser } from '../../api/auth'
import { useAuth } from '../../auth/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import { Select } from '../../components/ui/Select'
import { FloatingPanel } from '../../components/ui/FloatingPanel'

type ManagedRole = { id: string; name: string; company_domain?: string | null; active?: boolean; system?: boolean }
type Department = { id: string; name: string; company_domain: string; active: boolean }
type ManagedUser = {
  id: string; email: string; name: string; dept?: string | null
  departments?: { id: string; name: string }[]
  owned_departments?: { id: string; name: string }[]
  role: string; roles?: ManagedRole[]; company_domain: string; active: boolean
}
type Invitation = { id: string; email: string; name: string; role: string; status: string; expires_at: string }

const employeeRoles = ['Staff', 'Reviewer']
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'US'

function DepartmentPicker({ label, value, options, onChange, hint }: { label: string; value: string[]; options: Department[]; onChange: (value: string[]) => void; hint?: string }) {
  const [open, setOpen] = useState(false)
  const anchorRef = React.useRef<HTMLButtonElement>(null)
  const selected = options.filter(item => value.includes(item.id))
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id])

  return <div className="relative block"><div className="mb-1 flex items-center justify-between gap-2"><span className="label">{label}</span><span className="text-[10px] font-semibold text-muted">{selected.length}/{options.length}</span></div><button ref={anchorRef} type="button" aria-expanded={open} onClick={() => setOpen(current => !current)} className="field flex min-h-11 w-full items-center justify-between gap-3 text-left text-xs transition hover:border-primary/50"><span className={selected.length ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{selected.length ? `${selected.length} department${selected.length === 1 ? '' : 's'} selected` : 'Choose departments'}</span><ChevronDown size={15} className={`shrink-0 text-muted transition ${open ? 'rotate-180 text-primary' : ''}`} /></button><FloatingPanel anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} className="p-1.5"><div className="flex items-center justify-between border-b border-border px-2.5 py-2"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-muted">Department access</span>{selected.length > 0 && <button type="button" onClick={() => onChange([])} className="text-[10px] font-semibold text-primary hover:underline">Clear</button>}</div><div className="py-1">{options.length ? options.map(item => { const checked = value.includes(item.id); return <button key={item.id} type="button" onClick={() => toggle(item.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-surface-soft"><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-input'}`}>{checked && <Check size={11} strokeWidth={3} />}</span><span className="min-w-0 flex-1 truncate font-semibold">{item.name}</span><span className="text-[10px] text-muted">{item.active ? 'Active' : 'Inactive'}</span></button> }) : <p className="px-2.5 py-3 text-xs text-muted-foreground">No departments available.</p>}</div></FloatingPanel>{selected.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{selected.slice(0, 3).map(item => <span key={item.id} className="inline-flex items-center rounded-full border border-primary/15 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{item.name}</span>)}{selected.length > 3 && <span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-1 text-[10px] font-semibold text-muted">+{selected.length - 3} more</span>}</div>}{hint && <span className="mt-1.5 block text-[11px] text-muted-foreground">{hint}</span>}</div>
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const dialog = useDialog()
  const isAdmin = currentUser?.permission_scopes?.['user.manage'] === 'global'
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [roles, setRoles] = useState<ManagedRole[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [form, setForm] = useState({ email: '', name: '', department_ids: [] as string[], role: 'Staff', owned_department_ids: [] as string[] })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [actingId, setActingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [userData, roleData, departmentData, invitationData] = await Promise.all([listUsers(), listRoles(), listDepartments(), listInvitations()])
      setUsers(userData); setRoles(roleData); setDepartments(departmentData); setInvitations(invitationData); setError('')
    } catch (err: any) { setError(err.response?.data?.detail || 'Could not load employees') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const companies = useMemo(() => Object.entries(users.reduce<Record<string, ManagedUser[]>>((groups, item) => { (groups[item.company_domain] ||= []).push(item); return groups }, {})).sort(([a], [b]) => a.localeCompare(b)), [users])
  const stats = useMemo(() => ({ total: users.length, active: users.filter(item => item.active).length, inactive: users.filter(item => !item.active).length, companies: companies.length }), [companies.length, users])
  const visibleCompanies = useMemo(() => companies.map(([domain, employees]) => {
    const matched = employees.filter(employee => {
      const searchable = `${employee.name} ${employee.email} ${employee.dept || ''} ${(employee.departments || []).map(item => item.name).join(' ')} ${employee.role} ${(employee.roles || []).map(role => role.name).join(' ')}`.toLowerCase()
      return (companyFilter === 'all' || domain === companyFilter) && (statusFilter === 'all' || (statusFilter === 'active' ? employee.active : !employee.active)) && (!query.trim() || searchable.includes(query.trim().toLowerCase()))
    })
    return [domain, matched] as [string, ManagedUser[]]
  }).filter(([, employees]) => employees.length), [companies, companyFilter, query, statusFilter])

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setActingId('invite')
    try {
      const created = await createInvitation({ email: form.email, name: form.name, role: form.role, audience_ids: form.department_ids })
      setForm({ email: '', name: '', department_ids: [], role: 'Staff', owned_department_ids: [] })
      setMessage(`Invitation sent to ${created.email}`); setInviteOpen(false); await load()
    } catch (err: any) { setError(err.response?.data?.detail || 'Could not create employee') } finally { setActingId(null) }
  }

  const changeRoles = async (employee: ManagedUser, roleId: string) => {
    const next = new Set((employee.roles || []).map(item => item.id)); next.has(roleId) ? next.delete(roleId) : next.add(roleId)
    if (!next.size) return
    setActingId(employee.id)
    try { const updated = await updateUser(employee.id, { role_ids: [...next] }); setUsers(items => items.map(item => item.id === updated.id ? updated : item)); setMessage(`Updated roles for ${updated.name}`); setError('') }
    catch (err: any) { setError(err.response?.data?.detail || 'Could not update roles') } finally { setActingId(null) }
  }

  const changeMembership = async (employee: ManagedUser, departmentIds: string[]) => {
    setActingId(employee.id)
    try { const updated = await updateUser(employee.id, { department_ids: departmentIds }); setUsers(items => items.map(item => item.id === updated.id ? updated : item)); setMessage(`Updated department memberships for ${updated.name}`); setError('') }
    catch (err: any) { setError(err.response?.data?.detail || 'Could not update department memberships') } finally { setActingId(null) }
  }

  const changeOwnership = async (employee: ManagedUser, departmentIds: string[]) => {
    setActingId(employee.id)
    try { const updated = await updateUser(employee.id, { owned_department_ids: departmentIds }); setUsers(items => items.map(item => item.id === updated.id ? updated : item)); setMessage(`Updated owned departments for ${updated.name}`); setError('') }
    catch (err: any) { setError(err.response?.data?.detail || 'Could not update department ownership') } finally { setActingId(null) }
  }

  const makeCeo = async (domain: string, employee: ManagedUser) => {
    setActingId(`ceo-${domain}`)
    try { await assignCompanyCeo(domain, employee.id); await load(); setMessage(`${employee.name} is now CEO`) } catch (err: any) { setError(err.response?.data?.detail || 'Could not assign CEO') } finally { setActingId(null) }
  }
  const deactivate = async (employee: ManagedUser) => {
    if (!(await dialog.confirm(`Deactivate ${employee.name}? They will no longer be able to sign in.`, { title: 'Deactivate employee', confirmLabel: 'Deactivate', tone: 'danger' }))) return
    setActingId(employee.id); try { const updated = await deactivateUser(employee.id); setUsers(current => current.map(item => item.id === updated.id ? updated : item)); setMessage(`${employee.email} was deactivated`) } catch (err: any) { setError(err.response?.data?.detail || 'Could not deactivate employee') } finally { setActingId(null) }
  }
  const reactivate = async (employee: ManagedUser) => {
    setActingId(employee.id); try { const updated = await updateUser(employee.id, { active: true }); setUsers(current => current.map(item => item.id === updated.id ? updated : item)); setMessage(`${employee.email} is active again`); setError('') } catch (err: any) { setError(err.response?.data?.detail || 'Could not reactivate employee') } finally { setActingId(null) }
  }
  const resend = async (invitation: Invitation) => { setActingId(invitation.id); try { const updated = await resendInvitation(invitation.id); setInvitations(items => items.map(item => item.id === updated.id ? updated : item)); setMessage(`Invitation resent to ${updated.email}`) } catch (err: any) { setError(err.response?.data?.detail || 'Could not resend invitation') } finally { setActingId(null) } }
  const revoke = async (invitation: Invitation) => { setActingId(invitation.id); try { const updated = await revokeInvitation(invitation.id); setInvitations(items => items.map(item => item.id === updated.id ? updated : item)); setMessage(`Invitation revoked for ${updated.email}`) } catch (err: any) { setError(err.response?.data?.detail || 'Could not revoke invitation') } finally { setActingId(null) } }

  return <main className="page-shell-wide page-stack text-foreground">
    <header className="page-hero glass-panel rounded-panel border border-border px-4 py-5 shadow-[0_14px_34px_rgb(var(--shadow)/.1)] sm:px-6 sm:py-6"><div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Administration / people</p><h1 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-foreground sm:text-3xl">People &amp; access</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">One user can belong to many departments and hold many roles. Each department has one accountable owner.</p></div><button type="button" onClick={() => setInviteOpen(current => !current)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus size={16} /> {inviteOpen ? 'Close invite' : 'Invite employee'}</button></div><div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4"><Stat label="People" value={stats.total} icon={Users} /><Stat label="Active" value={stats.active} icon={Check} /><Stat label="Inactive" value={stats.inactive} icon={UserMinus} /><Stat label="Companies" value={stats.companies} icon={Building2} /></div></header>
    {inviteOpen && <form onSubmit={create} className="glass-panel rounded-panel space-y-4 border border-border p-4 sm:p-5"><div><h2 className="text-sm font-bold uppercase tracking-[.14em] text-muted">Invite employee</h2><p className="mt-1 text-xs text-muted-foreground">They will receive an email and sign in with Microsoft. Invitations expire after 7 days.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="block"><span className="label">Full name</span><input required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Jane Doe" className="field mt-1.5" /></label><label className="block"><span className="label">Work email</span><input required type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} placeholder="jane@company.com" className="field mt-1.5" /></label><label className="block"><span className="label">Audiences</span><select multiple value={form.department_ids} onChange={event => setForm(current => ({ ...current, department_ids: Array.from(event.target.selectedOptions, option => option.value) }))} className="field mt-1.5 h-24">{departments.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block"><span className="label">Role</span><Select value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value }))} className="mt-1.5">{employeeRoles.map(role => <option key={role} value={role}>{role}</option>)}</Select></label></div><div className="flex items-center justify-end gap-2"><button type="button" onClick={() => setInviteOpen(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-surface-soft">Cancel</button><button type="submit" disabled={actingId === 'invite'} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"><Mail size={15} /> {actingId === 'invite' ? 'Sending…' : 'Send invitation'}</button></div></form>}
    {invitations.some(item => item.status === 'pending') && <section className="rounded-xl border border-info/20 bg-info/5 p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-bold">Pending invitations</h2><p className="mt-1 text-xs text-muted-foreground">Invitations expire after seven days; resend to renew them.</p></div><Mail size={17} className="text-info" /></div><div className="space-y-2">{invitations.filter(item => item.status === 'pending').map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"><div><p className="text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{item.email} · expires {new Date(item.expires_at).toLocaleDateString()}</p></div><div className="flex gap-2"><button type="button" disabled={actingId === item.id} onClick={() => void resend(item)} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold">Resend</button><button type="button" disabled={actingId === item.id} onClick={() => void revoke(item)} className="rounded-md border border-destructive/20 px-2.5 py-1.5 text-xs font-semibold text-destructive">Revoke</button></div></div>)}</div></section>}
    {(message || error) && <div role="status" className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${error ? 'border-destructive/25 bg-destructive/10 text-destructive' : 'border-success/25 bg-success/10 text-success'}`}><span>{error || message}</span><button type="button" aria-label="Dismiss message" onClick={() => { setMessage(''); setError('') }}><X size={15} /></button></div>}
    <section className="rounded-xl border border-border bg-card p-3 sm:p-4"><div className="flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people, departments, or roles…" className="field w-full pl-9" /></div><Select value={companyFilter} onChange={event => setCompanyFilter(event.target.value)} className="sm:w-52"><option value="all">All companies</option>{companies.map(([domain]) => <option key={domain} value={domain}>{domain}</option>)}</Select><Select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="sm:w-40"><option value="active">Active</option><option value="all">All status</option><option value="inactive">Inactive</option></Select><button type="button" onClick={() => void load()} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border"><RefreshCw size={15} /></button></div></section>
    {loading ? <div className="grid min-h-64 place-items-center rounded-xl border border-border bg-card text-sm text-muted-foreground"><RefreshCw size={16} className="mr-2 animate-spin" /> Loading people…</div> : !visibleCompanies.length ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border bg-card p-8 text-center"><div><Search className="mx-auto text-muted" size={19} /><h2 className="mt-4 font-semibold">No people match these filters</h2></div></div> : <div className="space-y-5">{visibleCompanies.map(([domain, employees]) => <CompanyCard key={domain} domain={domain} employees={employees} allEmployees={users.filter(item => item.company_domain === domain)} departments={departments.filter(item => item.company_domain === domain)} roles={roles.filter(role => isAdmin ? (!role.company_domain || role.company_domain === domain) : role.company_domain === domain && role.name !== 'CEO')} isAdmin={isAdmin} currentUserId={currentUser?.id} actingId={actingId} onSetCeo={makeCeo} onRoleToggle={changeRoles} onMembershipChange={changeMembership} onOwnershipChange={changeOwnership} onDeactivate={deactivate} onReactivate={reactivate} />)}</div>}
  </main>
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) { return <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={15} /></span><div><p className="text-lg font-semibold leading-5">{value}</p><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">{label}</p></div></div> }

type CompanyCardProps = { domain: string; employees: ManagedUser[]; allEmployees: ManagedUser[]; departments: Department[]; roles: ManagedRole[]; isAdmin: boolean; currentUserId?: string; actingId: string | null; onSetCeo: (domain: string, employee: ManagedUser) => Promise<void>; onRoleToggle: (employee: ManagedUser, roleId: string) => Promise<void>; onMembershipChange: (employee: ManagedUser, departmentIds: string[]) => Promise<void>; onOwnershipChange: (employee: ManagedUser, departmentIds: string[]) => Promise<void>; onDeactivate: (employee: ManagedUser) => Promise<void>; onReactivate: (employee: ManagedUser) => Promise<void> }

function CompanyCard({ domain, employees, allEmployees, departments, roles, isAdmin, currentUserId, actingId, onSetCeo, onRoleToggle, onMembershipChange, onOwnershipChange, onDeactivate, onReactivate }: CompanyCardProps) {
  const ceo = allEmployees.find(item => item.role === 'CEO')
  return <section className="overflow-visible rounded-2xl border border-border bg-card"><header className="flex flex-col gap-4 border-b border-border bg-surface px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary"><Building2 size={18} /></span><div><h2 className="font-semibold">{domain}</h2><p className="mt-1 text-xs text-muted-foreground">{allEmployees.length} people · {departments.length} departments · {roles.length} available roles</p></div></div>{isAdmin ? <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><ShieldCheck size={15} /> Accountable CEO<Select value={ceo?.id || ''} onChange={event => { const chosen = allEmployees.find(item => item.id === event.target.value); if (chosen) void onSetCeo(domain, chosen) }} disabled={actingId === `ceo-${domain}`} className="w-56 text-xs"><option value="">No CEO assigned</option>{allEmployees.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label> : <span className="text-xs text-info">CEO: {ceo?.name || 'not assigned'}</span>}</header><div className="divide-y divide-border">{employees.map(employee => <EmployeeRow key={employee.id} employee={employee} departments={departments} roles={roles} isAdmin={isAdmin} currentUserId={currentUserId} actingId={actingId} onRoleToggle={onRoleToggle} onMembershipChange={onMembershipChange} onOwnershipChange={onOwnershipChange} onDeactivate={onDeactivate} onReactivate={onReactivate} />)}</div></section>
}

function EmployeeRow({ employee, departments, roles, isAdmin, currentUserId, actingId, onRoleToggle, onMembershipChange, onOwnershipChange, onDeactivate, onReactivate }: { employee: ManagedUser; departments: Department[]; roles: ManagedRole[]; isAdmin: boolean; currentUserId?: string; actingId: string | null; onRoleToggle: (employee: ManagedUser, roleId: string) => Promise<void>; onMembershipChange: (employee: ManagedUser, departmentIds: string[]) => Promise<void>; onOwnershipChange: (employee: ManagedUser, departmentIds: string[]) => Promise<void>; onDeactivate: (employee: ManagedUser) => Promise<void>; onReactivate: (employee: ManagedUser) => Promise<void> }) {
  const activeDepartments = departments.filter(item => item.active || (employee.departments || []).some(department => department.id === item.id))
  const assignedDepartmentIds = (employee.departments || []).map(item => item.id)
  const ownedDepartmentIds = (employee.owned_departments || []).map(item => item.id)
  return <article className={`p-5 transition hover:bg-surface-soft/50 ${!employee.active ? 'opacity-70' : ''}`}>
    <div className="grid gap-5 xl:grid-cols-[minmax(220px,.8fr)_minmax(0,1.8fr)_auto] xl:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-soft text-sm font-bold">{initials(employee.name)}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{employee.name}</h3>
            {employee.role === 'CEO' && <span className="rounded-full bg-info/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-info">CEO</span>}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{employee.email}</p>
          <div className="mt-3 space-y-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Member of</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(employee.departments || []).length ? (employee.departments || []).map(item => <span key={item.id} className="rounded-full border border-border bg-surface px-2 py-1 text-[10px] font-semibold text-muted-foreground">{item.name}</span>) : <span className="text-[11px] text-muted-foreground">No department membership</span>}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Owns</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(employee.owned_departments || []).length ? (employee.owned_departments || []).map(item => <span key={item.id} className="rounded-full border border-primary/15 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{item.name}</span>) : <span className="text-[11px] text-muted-foreground">No owned departments</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface/60 p-3">
          <DepartmentPicker label="Department memberships" value={assignedDepartmentIds} options={activeDepartments} onChange={value => void onMembershipChange(employee, value)} hint="Where this person works." />
        </div>
        <div className="rounded-xl border border-primary/15 bg-primary/[.03] p-3">
          <DepartmentPicker label="Owned departments" value={ownedDepartmentIds} options={departments.filter(item => item.active)} onChange={value => void onOwnershipChange(employee, value)} hint="One active owner per department." />
          <p className="mt-2 text-[11px] text-muted-foreground">Removing ownership does not deactivate the department.</p>
          <Link to="/admin/departments" className="mt-1 inline-flex text-[11px] font-semibold text-primary hover:underline">Manage department status →</Link>
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <p className="mr-1 basis-full text-[10px] font-bold uppercase tracking-[.12em] text-muted">Roles</p>
          {roles.map(role => <RoleToggle key={role.id} employee={employee} role={role} isAdmin={isAdmin} busy={actingId === employee.id} onChange={onRoleToggle} />)}
        </div>
      </div>
      <div className="flex shrink-0 items-start justify-start xl:justify-end">
        {employee.active ? <button type="button" title={employee.id === currentUserId ? 'You cannot deactivate yourself' : `Deactivate ${employee.name}`} disabled={employee.id === currentUserId || actingId === employee.id} onClick={() => void onDeactivate(employee)} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/20 px-3 py-2 text-xs font-semibold text-destructive"><UserMinus size={14} /> Deactivate</button> : <button type="button" disabled={actingId === employee.id} onClick={() => void onReactivate(employee)} className="inline-flex items-center gap-1.5 rounded-lg border border-success/20 px-3 py-2 text-xs font-semibold text-success"><UserPlus size={14} /> Reactivate</button>}
      </div>
    </div>
  </article>
}

function RoleToggle({ employee, role, isAdmin, busy, onChange }: { employee: ManagedUser; role: ManagedRole; isAdmin: boolean; busy: boolean; onChange: (employee: ManagedUser, roleId: string) => Promise<void> }) {
  const assigned = Boolean(employee.roles?.some(item => item.id === role.id))
  const disabled = !employee.active || (!isAdmin && employee.role === 'CEO') || busy || (role.active === false && !assigned)
  return <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${assigned ? 'border-primary/25 bg-primary/10 text-primary' : 'border-border bg-surface text-muted-foreground'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}><input type="checkbox" className="sr-only" checked={assigned} disabled={disabled} onChange={() => void onChange(employee, role.id)} /><span className={`grid h-3.5 w-3.5 place-items-center rounded border ${assigned ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-input'}`}>{assigned && <Check size={10} strokeWidth={3} />}</span>{role.name}{role.active === false && <span className="text-[9px] uppercase tracking-wide text-destructive">inactive</span>}</label>
}

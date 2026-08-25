import React, { useEffect, useMemo, useState } from 'react'
import { Check, CircleHelp, Filter, Plus, RotateCcw, Search, Shield, Sparkles, Users } from 'lucide-react'
import { createRole, listPermissions, listRoles, replaceRolePermissions, updateRole } from '../../api/auth'
import { usePermission } from '../../hooks/usePermission'
import { Select } from '../../components/ui/Select'

type Permission = { key: string; name: string; description?: string }
type Assignment = { permission_key?: string; key?: string; scope: string }
type Role = {
  id: string
  name: string
  description?: string
  company_domain?: string | null
  active: boolean
  system: boolean
  users_count?: number
  permissions: Assignment[]
}

const scopes = [
  { value: 'own', label: 'Only my content', hint: 'The user can access content they own.' },
  { value: 'department', label: 'My department', hint: 'The user can access content owned by people in their department.' },
  { value: 'company', label: 'Entire company', hint: 'The user can access content across their company.' },
  { value: 'global', label: 'All companies', hint: 'The user can access content across every company.' },
]

const presets: Record<string, Record<string, string>> = {
  Viewer: { 'article.read': 'company', 'ai.ask': 'company' },
  Editor: { 'article.read': 'company', 'article.create': 'own', 'article.edit': 'own', 'ai.ask': 'company' },
  Manager: {
    'article.read': 'company', 'article.create': 'department', 'article.edit': 'department',
    'article.review': 'department', 'article.publish': 'department', 'user.read': 'company', 'ai.ask': 'company',
  },
}

const groupLabels: Record<string, { label: string; description: string }> = {
  article: { label: 'Knowledge content', description: 'Create, edit, review, publish, and organize articles.' },
  user: { label: 'People', description: 'View and manage users in the permitted scope.' },
  role: { label: 'Administration', description: 'Manage roles, permissions, and platform configuration.' },
  permission: { label: 'Administration', description: 'Manage roles, permissions, and platform configuration.' },
  administration: { label: 'Administration', description: 'Manage roles, permissions, and platform configuration.' },
  connector: { label: 'Connected sources', description: 'Manage external knowledge connectors.' },
  ai: { label: 'AI assistant', description: 'Use AI retrieval and knowledge-base assistance.' },
  governance: { label: 'Governance', description: 'Review workflows and knowledge health.' },
}

function permissionKey(permission: Assignment) {
  return permission.permission_key || permission.key || ''
}

function groupForPermission(key: string) {
  const group = key.split('.')[0] || 'other'
  return group === 'role' || group === 'permission' ? 'administration' : group
}

export default function RolesPage() {
  const { has } = usePermission()
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selected, setSelected] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [savedDraft, setSavedDraft] = useState<Record<string, string>>({})
  const [roleSearch, setRoleSearch] = useState('')
  const [permissionSearch, setPermissionSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [newRole, setNewRole] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async (keepSelection = true) => {
    setLoading(true)
    try {
      const [roleData, permissionData] = await Promise.all([listRoles(), listPermissions()])
      setRoles(roleData)
      setPermissions(permissionData)
      if (!keepSelection || !roleData.some((item: Role) => item.id === selected)) setSelected(roleData[0]?.id || '')
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load roles and permissions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load(false) }, [])

  const role = roles.find(item => item.id === selected)
  const roleAssignments = useMemo(() => {
    const values: Record<string, string> = {}
    role?.permissions.forEach(item => {
      const key = permissionKey(item)
      if (key) values[key] = item.scope
    })
    return values
  }, [role])

  useEffect(() => {
    setDraft(roleAssignments)
    setSavedDraft(roleAssignments)
    setPermissionSearch('')
    setScopeFilter('all')
  }, [roleAssignments])

  const filteredRoles = roles.filter(item => `${item.name} ${item.company_domain || 'Global'}`.toLowerCase().includes(roleSearch.toLowerCase()))
  const changedKeys = Object.keys({ ...draft, ...savedDraft }).filter(key => draft[key] !== savedDraft[key])
  const isDirty = changedKeys.length > 0
  const canEdit = Boolean(role && !role.system && role.active && has('permission.manage'))

  const groupedPermissions = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase()
    return permissions
      .filter(permission => !query || `${permission.key} ${permission.name} ${permission.description || ''}`.toLowerCase().includes(query))
      .filter(permission => scopeFilter === 'all' ? true : scopeFilter === '__denied' ? !draft[permission.key] : draft[permission.key] === scopeFilter)
      .reduce<Record<string, Permission[]>>((groups, permission) => {
        const group = groupForPermission(permission.key)
        groups[group] = [...(groups[group] || []), permission]
        return groups
      }, {})
  }, [permissions, permissionSearch, scopeFilter, draft])

  const updatePermission = (key: string, scope: string) => {
    setDraft(current => {
      const next = { ...current }
      if (scope) next[key] = scope
      else delete next[key]
      return next
    })
    setMessage('')
    setError('')
  }

  const applyPreset = (name: string) => {
    if (!canEdit) return
    setDraft(presets[name])
    setMessage(`${name} preset applied. Review the changes before saving.`)
    setError('')
  }

  const save = async () => {
    if (!role || !canEdit || saving) return
    setSaving(true)
    try {
      await replaceRolePermissions(role.id, Object.entries(draft).map(([permission_key, scope]) => ({ permission_key, scope })))
      setSavedDraft(draft)
      setRoles(current => current.map(item => item.id === role.id
        ? { ...item, permissions: Object.entries(draft).map(([permission_key, scope]) => ({ permission_key, scope })) }
        : item))
      setMessage(`Permissions saved for ${role.name}`)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not save permissions')
    } finally {
      setSaving(false)
    }
  }

  const reactivate = async () => {
    if (!role || role.system) return
    try {
      const updated = await updateRole(role.id, { active: true })
      setRoles(current => current.map(item => item.id === updated.id ? { ...item, active: true } : item))
      setMessage(`${role.name} is active again`)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not reactivate role')
    }
  }

  const addRole = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newRole.trim()) return
    try {
      const created = await createRole({ name: newRole.trim() })
      setNewRole('')
      setShowCreate(false)
      await load()
      setSelected(created.id)
      setMessage(`Created ${created.name}. Start with a preset or choose permissions below.`)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not create role')
    }
  }

  return <main className="page-shell-wide page-stack text-ink">
    <header className="flex flex-col gap-4 border-b border-hairline-soft pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-stone"><Shield size={14} className="text-cyan-700" /> Access control</div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Roles &amp; permissions</h1>
        <p className="mt-1 max-w-2xl text-sm text-steel">Decide who can do what, and how far their access reaches. Changes only apply after you save.</p>
      </div>
      <button type="button" onClick={() => setShowCreate(current => !current)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-slate-700"><Plus size={16} /> New role</button>
    </header>

    {(message || error) && <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-rose-500/20 bg-rose-500/10 text-rose-600' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'}`}>{error || message}</div>}

    {showCreate && <form onSubmit={addRole} className="flex flex-col gap-3 rounded-xl border border-cyan/20 bg-cyan-50/60 p-4 sm:flex-row sm:items-center"><div className="flex-1"><label htmlFor="new-role" className="text-sm font-semibold">Create a company role</label><p className="text-xs text-steel">Use a clear name such as “Security Reviewer” or “Operations Editor”.</p></div><input id="new-role" autoFocus className="field sm:w-64" placeholder="Role name" value={newRole} onChange={event => setNewRole(event.target.value)} /><button className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-cyan-800">Create role</button></form>}

    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="h-fit rounded-xl border border-hairline bg-surface p-3 lg:sticky lg:top-6">
        <div className="mb-3 flex items-center justify-between px-2"><p className="text-xs font-bold uppercase tracking-widest text-stone">Roles</p><span className="rounded-full bg-surface-soft px-2 py-0.5 text-body-sm text-stone">{roles.length}</span></div>
        <div className="relative mb-3"><Search size={15} className="absolute left-3 top-2.5 text-stone" /><input aria-label="Search roles" className="field w-full pl-9 text-xs" placeholder="Find a role…" value={roleSearch} onChange={event => setRoleSearch(event.target.value)} /></div>
        <div className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
          {loading ? <p className="px-3 py-8 text-center text-xs text-stone">Loading roles…</p> : filteredRoles.map(item => <button key={item.id} type="button" onClick={() => setSelected(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${selected === item.id ? 'bg-ink text-primary-foreground shadow-sm' : 'hover:bg-surface-soft'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${selected === item.id ? 'bg-white/15 text-primary-foreground' : 'bg-canvas text-steel'}`}><Users size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.name}</span><span className={`block truncate text-body-sm ${selected === item.id ? 'text-primary-foreground/60' : 'text-stone'}`}>{item.company_domain || 'Global'}{item.system ? ' · system' : ''}</span></span>{item.system && <span className="text-caption text-cyan">Built-in</span>}</button>)}
          {!loading && !filteredRoles.length && <p className="px-3 py-8 text-center text-xs text-stone">No matching roles.</p>}
        </div>
      </aside>

      <section className="min-w-0">
        {!role ? <div className="rounded-xl border border-dashed border-hairline p-12 text-center text-sm text-stone">Select a role to manage its access.</div> : <>
          <div className="mb-5 rounded-xl border border-hairline bg-surface p-5"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{role.name}</h2><span className="rounded-full bg-surface-soft px-2.5 py-1 text-body-sm font-semibold text-steel">{role.company_domain || 'Global role'}</span>{role.system && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-body-sm font-semibold text-amber-700">Read-only system role</span>}{!role.active && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-body-sm font-semibold text-rose-700">Inactive</span>}</div><p className="mt-1 text-sm text-steel">{role.description || (role.system ? 'This role is managed by the platform defaults.' : 'Custom company role')}</p>{!has('permission.manage') && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">You can view roles, but permission.manage is required to change permission scopes.</p>}</div><div className="flex items-start gap-3"><div className="rounded-lg bg-canvas px-4 py-3 text-right"><p className="text-2xl font-semibold">{Object.keys(draft).length}</p><p className="text-body-sm text-stone">permissions granted</p></div>{!role.active && !role.system && <button type="button" onClick={() => void reactivate()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-emerald-800"><RotateCcw size={14} /> Reactivate role</button>}</div></div>
            {canEdit && <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hairline-soft pt-4"><span className="mr-1 text-xs font-semibold text-steel"><Sparkles size={14} className="mr-1 inline text-cyan-700" />Quick start</span>{Object.keys(presets).map(name => <button key={name} type="button" onClick={() => applyPreset(name)} className="rounded-full border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-steel hover:border-cyan-600 hover:text-cyan-800">{name}</button>)}<button type="button" onClick={() => setDraft({})} className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">Clear all</button></div>}
          </div>

          <div className="mb-4 rounded-xl border border-hairline bg-surface p-3"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-2.5 text-stone" /><input aria-label="Search permissions" className="field w-full pl-9 text-xs" placeholder="Search permissions by name or key…" value={permissionSearch} onChange={event => setPermissionSearch(event.target.value)} /></div><div className="relative"><Filter size={14} className="pointer-events-none absolute left-3 top-2.5 text-stone" /><Select aria-label="Filter permissions by scope" className="w-full text-xs sm:w-52" value={scopeFilter} onChange={event => setScopeFilter(event.target.value)}><option value="all">Show all permissions</option>{scopes.map(scope => <option key={scope.value} value={scope.value}>{scope.label}</option>)}<option value="__denied">No access</option></Select></div></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-hairline-soft pt-3 text-body-sm text-steel"><span className="font-semibold text-ink">Access level:</span>{scopes.map(scope => <span key={scope.value}><strong className="font-semibold text-steel">{scope.label}</strong> — {scope.hint.replace('The user can ', '').replace('The user ', '')}</span>)}<span><strong className="font-semibold text-steel">No access</strong> — permission is turned off</span></div></div>

          {scopeFilter === '__denied' && <div className="mb-4 rounded-lg border border-dashed border-hairline bg-surface-soft px-4 py-3 text-xs text-steel">These permissions are currently set to <strong className="font-semibold text-ink">No access</strong> for this role. Choose an access level to grant permission.</div>}
          <div className="space-y-4">{Object.entries(groupedPermissions).map(([group, items]) => { const meta = groupLabels[group] || { label: 'Other permissions', description: 'Additional access controls.' }; return <section key={group} className="overflow-hidden rounded-xl border border-hairline bg-surface"><div className="border-b border-hairline-soft bg-canvas px-5 py-4"><h3 className="font-semibold">{meta.label}</h3><p className="mt-0.5 text-xs text-stone">{meta.description}</p></div><div className="divide-y divide-hairline-soft">{items.map(permission => <div key={permission.key} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-semibold">{permission.name}</p>{draft[permission.key] && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-caption font-semibold text-emerald-700">Granted</span>}</div><p className="mt-0.5 font-mono text-body-sm text-stone">{permission.key}</p>{permission.description && <p className="mt-1 text-xs text-steel">{permission.description}</p>}</div><div className="flex items-center gap-2 md:w-52 md:justify-end"><div className="w-full md:w-48"><Select aria-label={`Access level for ${permission.name}`} disabled={!canEdit} className="field w-full pr-8 text-xs" value={draft[permission.key] || ''} onChange={event => updatePermission(permission.key, event.target.value)}><option value="">No access</option>{scopes.map(scope => <option key={scope.value} value={scope.value}>{scope.label}</option>)}</Select></div><CircleHelp size={15} className="hidden shrink-0 text-stone md:block" aria-label={scopes.find(scope => scope.value === draft[permission.key])?.hint || 'No access: this permission is turned off'} /></div></div>)}</div></section> })}</div>
          {!Object.keys(groupedPermissions).length && <div className="rounded-xl border border-dashed border-hairline p-12 text-center text-sm text-stone">No permissions match your filters.</div>}
        </>}
      </section>
    </div>

    {role && canEdit && <div className={`sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between ${isDirty ? 'border-info/30 bg-info/10' : 'border-border bg-surface-elevated'}`}><div className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${isDirty ? 'bg-info text-accent-foreground' : 'bg-surface-soft text-stone'}`}>{isDirty ? <Sparkles size={15} /> : <Check size={15} />}</span><div><p className="text-sm font-semibold">{isDirty ? `${changedKeys.length} unsaved change${changedKeys.length === 1 ? '' : 's'}` : 'All changes saved'}</p><p className="text-xs text-steel">{isDirty ? 'Review the access scopes, then save this role.' : 'This role is up to date.'}</p></div></div><div className="flex gap-2"><button type="button" disabled={!isDirty || saving} onClick={() => setDraft(savedDraft)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-steel hover:bg-surface-soft disabled:opacity-40"><RotateCcw size={14} /> Discard</button><button type="button" disabled={!isDirty || saving} onClick={() => void save()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40">{saving ? 'Saving…' : 'Save permissions'}<Check size={14} /></button></div></div>}
  </main>
}

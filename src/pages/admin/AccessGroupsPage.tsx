import React, { useEffect, useMemo, useState } from 'react'
import { Check, Plus, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { createAccessGroup, listAccessGroupMembers, listAccessGroups, listUsers, replaceAccessGroupMembers } from '../../api/auth'
import PageHeader from '../../components/ui/PageHeader'

type Group = { id: string; name: string; company_domain: string; bitmask_position: number }
type User = { id: string; name: string; email: string; company_domain: string; active: boolean }
type Member = { id: string; name: string; email: string; active: boolean }

export default function AccessGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [members, setMembers] = useState<Record<string, Member[]>>({})
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [nextGroups, nextUsers] = await Promise.all([listAccessGroups(), listUsers()])
      setGroups(nextGroups)
      setUsers(nextUsers)
      const memberEntries = await Promise.all(nextGroups.map(async (group: Group) => [group.id, await listAccessGroupMembers(group.id)] as const))
      setMembers(Object.fromEntries(memberEntries))
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || 'Could not load access groups')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const visibleUsers = useMemo(() => users.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase())), [users, query])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setBusy('create')
    try {
      await createAccessGroup(name.trim())
      setName('')
      setMessage('Access group created.')
      await load()
    } catch (requestError: any) { setError(requestError?.response?.data?.detail || 'Could not create access group') }
    finally { setBusy(null) }
  }

  const toggle = async (group: Group, userId: string) => {
    const current = members[group.id] || []
    const nextIds = current.some(user => user.id === userId) ? current.filter(user => user.id !== userId).map(user => user.id) : [...current.map(user => user.id), userId]
    setBusy(group.id)
    try {
      await replaceAccessGroupMembers(group.id, nextIds)
      setMembers(state => ({ ...state, [group.id]: users.filter(user => nextIds.includes(user.id)).map(user => ({ id: user.id, name: user.name, email: user.email, active: user.active })) }))
      setMessage(`Updated members for ${group.name}.`)
      setError('')
    } catch (requestError: any) { setError(requestError?.response?.data?.detail || 'Could not update group members') }
    finally { setBusy(null) }
  }

  return <main className="page-shell-wide page-stack text-foreground">
    <PageHeader eyebrow="Administration / access" title="Access groups" description="Manage the explicit access groups used by article ACLs and cloud-provider mappings." icon={ShieldCheck} actions={<button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-surface-soft"><RefreshCw size={14} /> Refresh</button>} />
    <form onSubmit={create} className="glass-panel flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-end"><label className="min-w-0 flex-1"><span className="label">New access group</span><input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Finance reviewers" className="field mt-1.5 w-full" /></label><button type="submit" disabled={busy === 'create'} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"><Plus size={15} /> Create group</button></form>
    {(message || error) && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-destructive/25 bg-destructive/10 text-destructive' : 'border-success/25 bg-success/10 text-success'}`}>{error || message}</div>}
    <section className="rounded-2xl border border-border bg-surface p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold">Group membership</h2><p className="mt-1 text-xs text-muted-foreground">Changes are applied immediately and remain company-scoped.</p></div><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a user…" className="field sm:w-64" /></div></section>
    {loading ? <div className="grid min-h-48 place-items-center rounded-xl border border-border bg-surface text-sm text-muted-foreground"><RefreshCw size={16} className="mr-2 animate-spin" /> Loading groups…</div> : !groups.length ? <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">No access groups yet.</div> : <div className="grid gap-4 lg:grid-cols-2">{groups.map(group => { const groupMembers = members[group.id] || []; return <article key={group.id} className="overflow-hidden rounded-2xl border border-border bg-surface"><header className="flex items-center justify-between border-b border-border bg-surface-soft px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Users size={17} /></span><div><h3 className="text-sm font-bold">{group.name}</h3><p className="mt-1 text-[11px] text-muted-foreground">Bit position {group.bitmask_position} · {groupMembers.length} member{groupMembers.length === 1 ? '' : 's'}</p></div></div>{busy === group.id && <RefreshCw size={14} className="animate-spin text-primary" />}</header><div className="max-h-80 overflow-y-auto p-3">{visibleUsers.map(user => { const checked = groupMembers.some(member => member.id === user.id); return <label key={user.id} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs transition ${checked ? 'bg-primary/10' : 'hover:bg-surface-soft'} ${!user.active ? 'opacity-50' : ''}`}><input type="checkbox" checked={checked} disabled={busy === group.id || !user.active} onChange={() => void toggle(group, user.id)} className="sr-only" /><span className={`grid h-4 w-4 place-items-center rounded border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-input'}`}>{checked && <Check size={11} strokeWidth={3} />}</span><span className="min-w-0"><span className="block truncate font-semibold">{user.name}</span><span className="block truncate text-[10px] text-muted-foreground">{user.email}</span></span></label> })}</div></article>})}</div>}
  </main>
}

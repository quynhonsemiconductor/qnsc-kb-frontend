import React, { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Cloud,
  ExternalLink,
  FolderOpen,
  FolderTree,
  FolderSync,
  HardDrive,
  History,
  Link2,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  FileText,
  Webhook,
  X,
} from 'lucide-react'
import {
  createConnector,
  ConnectorAclPrincipal,
  getConnectorReadme,
  getConnectorSourceTree,
  listConnectorJobs,
  listConnectorAclPrincipals,
  listConnectorScopes,
  previewConnector,
  listConnectors,
  selectConnectorScopes,
  setConnectorGroupMapping,
  startConnectorOAuth,
  subscribeConnectorWebhooks,
  syncConnector,
  updateConnector,
} from '../../api/connectors'
import { listAccessGroups, listDepartments } from '../../api/auth'
import { safeExternalUrl } from '../../lib/formatters'
import { Select } from '../../components/ui/Select'

type Connector = {
  id: string
  name: string
  system: string
  status: string
  company_domain: string
  path?: string
  last_sync?: string
  last_error?: string
  authorized?: boolean
  sync_mode: string
  webhook_enabled?: boolean
  department_ids?: string[]
  department_names?: string[]
}

type Scope = {
  external_scope_id: string
  display_name: string
  scope_type: string
  selected: boolean
  config?: {
    web_url?: string
    location_label?: string
    site_name?: string
    drive_name?: string
  }
}

type ConnectorState = 'healthy' | 'attention' | 'needs_action'
type Filter = 'all' | ConnectorState
type SyncItem = { name: string; action: string; scope?: string; web_url?: string }
type SyncSummary = { scope_count?: number; changes_seen?: number; files_seen?: number; imported?: number; updated?: number; deleted?: number; unchanged?: number; permissions_updated?: number; items?: SyncItem[] }
type ConnectorJob = { id: string; status: string; attempts: number; last_error?: string; created_at?: string; completed_at?: string; summary?: SyncSummary }
type PreviewFile = { name: string; mime_type?: string | null; web_url?: string | null; revision?: string | null; scope?: string }
type ConnectorPreview = { files: PreviewFile[]; files_returned: number; scopes: number; truncated: boolean; errors?: string[]; writes_performed: boolean }
type SourceTree = { connector_id: string; connector_name: string; system: string; files_indexed: number; scopes: { id: string; display_name: string; scope_type: string; nodes: { id: string; name: string; parent_external_id?: string | null; is_folder: boolean; state: string; article_id?: string | null; web_url?: string | null }[] }[] }
type ConnectorReadme = { connector_id: string; generated_at: string; markdown: string }
type Department = { id: string; name: string; company_domain: string; active: boolean }
type AccessGroup = { id: string; name: string; company_domain: string; bitmask_position: number }

const providerInfo: Record<string, { label: string; description: string }> = {
  google_drive: {
    label: 'Google Drive',
    description: 'Shared drives and folders from Google Workspace.',
  },
  sharepoint: {
    label: 'SharePoint',
    description: 'Sites, document libraries, and folders from Microsoft 365.',
  },
}

const getProvider = (system: string) => providerInfo[system] || { label: system, description: 'Cloud source' }

const getConnectorState = (item: Connector): ConnectorState => {
  if (!item.authorized) return 'needs_action'
  if (item.status === 'error' || item.last_error) return 'attention'
  return 'healthy'
}

const stateInfo: Record<ConnectorState, { label: string; description: string; className: string; icon: React.ReactNode }> = {
  healthy: {
    label: 'Healthy',
    description: 'Connected and ready to sync',
    className: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700',
    icon: <CheckCircle2 size={13} />,
  },
  attention: {
    label: 'Needs attention',
    description: 'The latest operation needs a look',
    className: 'border-amber-400/30 bg-amber-500/10 text-amber-700',
    icon: <AlertCircle size={13} />,
  },
  needs_action: {
    label: 'Action required',
    description: 'Authorize this source to get started',
    className: 'border-sky-400/30 bg-sky-500/10 text-sky-700',
    icon: <ShieldCheck size={13} />,
  },
}

const formatDate = (value?: string) => {
  if (!value) return 'Never synced'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const getErrorMessage = (requestError: any, fallback: string) => requestError?.response?.data?.detail || fallback

export default function ConnectorsPage() {
  const [items, setItems] = useState<Connector[]>([])
  const [form, setForm] = useState({ name: '', system: 'google_drive' })
  const [departments, setDepartments] = useState<Department[]>([])
  const [scopes, setScopes] = useState<Record<string, Scope[]>>({})
  const [jobs, setJobs] = useState<Record<string, ConnectorJob[]>>({})
  const [previews, setPreviews] = useState<Record<string, ConnectorPreview>>({})
  const [sourceTrees, setSourceTrees] = useState<Record<string, SourceTree>>({})
  const [readmes, setReadmes] = useState<Record<string, ConnectorReadme>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [activityOpenId, setActivityOpenId] = useState<string | null>(null)
  const [sourceMapOpenId, setSourceMapOpenId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [scopeLoadingId, setScopeLoadingId] = useState<string | null>(null)
  const [jobLoadingId, setJobLoadingId] = useState<string | null>(null)
  const [departmentOpenId, setDepartmentOpenId] = useState<string | null>(null)
  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, string[]>>({})
  const [accessGroups, setAccessGroups] = useState<AccessGroup[]>([])
  const [aclPrincipals, setAclPrincipals] = useState<Record<string, ConnectorAclPrincipal[]>>({})
  const [aclOpenId, setAclOpenId] = useState<string | null>(null)
  const [aclLoadingId, setAclLoadingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const refreshConnectors = async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      setItems(await listConnectors())
      setError('')
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not load source connectors'))
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    void refreshConnectors()
  }, [])

  useEffect(() => {
    void listDepartments().then((result: Department[]) => setDepartments(result.filter(item => item.active))).catch(() => setDepartments([]))
    void listAccessGroups().then((result: AccessGroup[]) => setAccessGroups(result)).catch(() => setAccessGroups([]))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauth = params.get('oauth')
    const connectorId = params.get('connector_id')
    if (oauth) {
      const payload = { type: 'connector-oauth-result', status: oauth, connectorId }
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(payload, window.location.origin)
        window.setTimeout(() => window.close(), 250)
      } else if (oauth === 'success') {
        setMessage('Connector authorized. Choose the folders or drives to sync.')
        void refreshConnectors(true)
      } else {
        setError('Authorization was not completed. Check the provider settings and try again.')
      }
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  useEffect(() => {
    const receiveOAuthResult = (event: MessageEvent<{ type?: string; status?: string }>) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'connector-oauth-result') return
      if (event.data.status === 'success') {
        setError('')
        setMessage('Connector authorized. Choose the folders or drives to sync.')
        void refreshConnectors(true)
      } else {
        setError('Authorization was not completed. Check the provider settings and try again.')
      }
    }
    window.addEventListener('message', receiveOAuthResult)
    return () => window.removeEventListener('message', receiveOAuthResult)
  }, [])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setBusy('create')
    setError('')
    try {
      const item = await createConnector({ name: form.name.trim(), system: form.system, config: { sync_mode: 'daily' } })
      setItems(current => [...current, item])
      setForm({ name: '', system: 'google_drive' })
      setMessage(`${getProvider(form.system).label} connector created. Authorize it to continue.`)
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not create connector'))
    } finally {
      setBusy(null)
    }
  }

  const authorize = async (item: Connector) => {
    const authWindow = window.open('', '_blank')
    if (!authWindow) {
      setError('The authorization window was blocked. Allow popups for this site and try again.')
      return
    }
    authWindow.document.title = 'Opening provider authorization…'
    authWindow.document.body.innerHTML = '<p style="font-family: system-ui; padding: 2rem; color: #334155">Opening secure authorization…</p>'
    setBusy(`authorize:${item.id}`)
    setError('')
    try {
      const result = await startConnectorOAuth(item.id)
      authWindow.location.href = result.authorization_url
      authWindow.focus()
    } catch (requestError: any) {
      authWindow.close()
      setError(getErrorMessage(requestError, 'Could not start authorization'))
    } finally {
      setBusy(null)
    }
  }

  const loadScopes = async (item: Connector, force = false) => {
    if (!force && openId === item.id) {
      setOpenId(null)
      return
    }
    setOpenId(item.id)
    if (!force && scopes[item.id]) return
    setScopeLoadingId(item.id)
    setError('')
    try {
      const discovered = await listConnectorScopes(item.id)
      setScopes(current => ({ ...current, [item.id]: discovered }))
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not discover source locations'))
    } finally {
      setScopeLoadingId(null)
    }
  }

  const loadPreview = async (item: Connector) => {
    setBusy(`preview:${item.id}`)
    setError('')
    try {
      const preview: ConnectorPreview = await previewConnector(item.id, 50)
      setPreviews(current => ({ ...current, [item.id]: preview }))
      setMessage(`${item.name} preview loaded. No files were imported.`)
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not preview the selected source locations'))
    } finally { setBusy(null) }
  }

  const loadSourceMap = async (item: Connector, force = false) => {
    if (!force && sourceMapOpenId === item.id) {
      setSourceMapOpenId(null)
      return
    }
    setSourceMapOpenId(item.id)
    if (!force && sourceTrees[item.id] && readmes[item.id]) return
    setBusy(`source-map:${item.id}`)
    setError('')
    try {
      const [tree, readme] = await Promise.all([getConnectorSourceTree(item.id), getConnectorReadme(item.id)])
      setSourceTrees(current => ({ ...current, [item.id]: tree }))
      setReadmes(current => ({ ...current, [item.id]: readme }))
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not load the source map'))
    } finally { setBusy(null) }
  }

  const loadJobs = async (item: Connector, force = false) => {
    if (!force && activityOpenId === item.id) {
      setActivityOpenId(null)
      return
    }
    setActivityOpenId(item.id)
    if (!force && jobs[item.id]) return
    setJobLoadingId(item.id)
    setError('')
    try {
      const history: ConnectorJob[] = await listConnectorJobs(item.id, 10)
      setJobs(current => ({ ...current, [item.id]: history }))
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not load sync activity'))
    } finally {
      setJobLoadingId(null)
    }
  }

  const loadAcl = async (item: Connector, force = false) => {
    if (!force && aclOpenId === item.id) {
      setAclOpenId(null)
      return
    }
    setAclOpenId(item.id)
    if (!force && aclPrincipals[item.id]) return
    setAclLoadingId(item.id)
    setError('')
    try {
      const principals = await listConnectorAclPrincipals(item.id)
      setAclPrincipals(current => ({ ...current, [item.id]: principals }))
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not load provider permission principals'))
    } finally {
      setAclLoadingId(null)
    }
  }

  const toggleDepartments = (item: Connector) => {
    if (departmentOpenId === item.id) {
      setDepartmentOpenId(null)
      return
    }
    setDepartmentDrafts(current => ({ ...current, [item.id]: current[item.id] || item.department_ids || [] }))
    setDepartmentOpenId(item.id)
  }

  const pollSyncJob = async (item: Connector, jobId: string) => {
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      const history: ConnectorJob[] = await listConnectorJobs(item.id, 10)
      setJobs(current => ({ ...current, [item.id]: history }))
      const job = history.find(entry => entry.id === jobId)
      if (job && ['completed', 'failed'].includes(job.status)) return job
      await new Promise(resolve => window.setTimeout(resolve, 2_000))
    }
    return null
  }

  const saveScopes = async (item: Connector, selected: string[]) => {
    setBusy(`scopes:${item.id}`)
    setError('')
    try {
      const saved = await selectConnectorScopes(item.id, selected)
      setScopes(current => ({ ...current, [item.id]: saved }))
      setMessage(`Sync locations saved for ${item.name}`)
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not save source locations'))
    } finally {
      setBusy(null)
    }
  }

  const changeMode = async (item: Connector, sync_mode: string) => {
    setBusy(`schedule:${item.id}`)
    setError('')
    try {
      const updated = await updateConnector(item.id, { sync_mode })
      setItems(current => current.map(currentItem => currentItem.id === updated.id ? updated : currentItem))
      setMessage(`${item.name} will sync ${sync_mode === 'daily' ? 'daily' : sync_mode === 'on_update' ? 'when updates are detected' : 'manually'}.`)
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not update sync schedule'))
    } finally {
      setBusy(null)
    }
  }

  const saveDepartments = async (item: Connector, department_ids: string[]) => {
    setBusy(`departments:${item.id}`)
    setError('')
    try {
      const updated = await updateConnector(item.id, { department_ids })
      setItems(current => current.map(currentItem => currentItem.id === updated.id ? updated : currentItem))
      setDepartmentDrafts(current => ({ ...current, [item.id]: updated.department_ids || [] }))
      setMessage(department_ids.length ? `New drafts from ${item.name} will route to ${updated.department_names?.join(', ')}.` : `Default department routing cleared for ${item.name}.`)
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not save department routing'))
    } finally {
      setBusy(null)
    }
  }

  const saveAclMapping = async (item: Connector, principal: ConnectorAclPrincipal, access_group_id: string) => {
    setBusy(`acl:${item.id}:${principal.principal_id}`)
    setError('')
    try {
      const result = await setConnectorGroupMapping(item.id, principal.principal_id, {
        access_group_id,
        external_group_name: principal.external_group_name || undefined,
      })
      await loadAcl(item, true)
      setMessage(`Mapped provider group ${principal.principal_id}; ${result.articles_reconciled || 0} Article permission set${result.articles_reconciled === 1 ? '' : 's'} reconciled.`)
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not save provider permission mapping'))
    } finally {
      setBusy(null)
    }
  }

  const enableWebhooks = async (item: Connector) => {
    setBusy(`webhook:${item.id}`)
    setError('')
    try {
      await subscribeConnectorWebhooks(item.id)
      setItems(current => current.map(currentItem => currentItem.id === item.id ? { ...currentItem, sync_mode: 'on_update', webhook_enabled: true } : currentItem))
      setMessage(`Update notifications enabled for ${item.name}`)
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not enable update notifications'))
    } finally {
      setBusy(null)
    }
  }

  const sync = async (item: Connector) => {
    setBusy(`sync:${item.id}`)
    setError('')
    setMessage(`Syncing ${item.name}…`)
    setActivityOpenId(item.id)
    try {
      const result = await syncConnector(item.id)
      const jobId = result.job_id as string
      const finishedJob = await pollSyncJob(item, jobId)
      await refreshConnectors(true)
      if (finishedJob?.status === 'completed') {
        const summary = finishedJob.summary || {}
        const imported = Number(summary.imported || 0)
        const updated = Number(summary.updated || 0)
        const deleted = Number(summary.deleted || 0)
        const changed = imported + updated + deleted
        setMessage(`${item.name} sync completed: ${changed} file${changed === 1 ? '' : 's'} changed. Open Sync activity to see the exact files.`)
      } else if (finishedJob?.status === 'failed') {
        setError(finishedJob.last_error || `${item.name} sync failed. Open Sync activity for details.`)
      } else {
        setMessage(`${item.name} sync is still running. Open Sync activity to follow its progress.`)
      }
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not start or monitor sync'))
    } finally {
      setBusy(null)
    }
  }

  const counts = useMemo(() => items.reduce((result, item) => {
    result.total += 1
    result[getConnectorState(item)] += 1
    return result
  }, { total: 0, healthy: 0, attention: 0, needs_action: 0 }), [items])

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return items
      .filter(item => filter === 'all' || getConnectorState(item) === filter)
      .filter(item => !normalizedSearch || [item.name, item.system, item.company_domain, item.path].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch))
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [filter, items, search])

  return (
    <main className="page-shell-wide page-stack pb-8 text-ink">
      <header className="page-hero glass-panel soft-grid relative overflow-hidden rounded-panel border border-border px-4 py-5 shadow-[0_16px_42px_rgb(var(--shadow)/.08)] sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-info/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-cyan/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-muted">
              <span>Administration</span><span className="text-border">/</span><span className="text-info">Integrations</span>
            </div>
            <div className="mt-4 flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-info/20 bg-info/10 text-info shadow-inner"><Cloud size={22} /></span>
              <div><h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Connector control center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Bring your trusted workspaces into the Knowledge Base. Monitor health, control syncs, and choose exactly which locations are indexed.</p></div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 lg:self-auto"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Workspace connected</div>
        </div>
      </header>

      {(message || error) && <div role={error ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${error ? 'border-rose-400/25 bg-rose-500/10 text-rose-700' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700'}`}><span className="mt-0.5">{error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}</span><span className="min-w-0 flex-1">{error || message}</span><button type="button" aria-label="Dismiss message" onClick={() => { setMessage(''); setError('') }} className="rounded-md p-0.5 opacity-70 hover:bg-black/5 hover:opacity-100"><X size={15} /></button></div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Connector overview">
        <MetricCard icon={<Link2 size={17} />} label="Connected sources" value={counts.total} detail={counts.total === 1 ? '1 integration in this workspace' : `${counts.total} integrations in this workspace`} tone="info" />
        <MetricCard icon={<CheckCircle2 size={17} />} label="Healthy" value={counts.healthy} detail="Ready for the next sync" tone="success" />
        <MetricCard icon={<ShieldCheck size={17} />} label="Needs authorization" value={counts.needs_action} detail="One secure sign-in away" tone="warning" />
        <MetricCard icon={<AlertCircle size={17} />} label="Needs attention" value={counts.attention} detail="Review the latest operation" tone="danger" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <form onSubmit={create} className="rounded-[24px] border border-border bg-surface p-5 shadow-[0_14px_36px_rgb(var(--shadow)/.06)] sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-ink text-primary-foreground"><Plus size={16} /></span><h2 className="text-base font-bold text-foreground">Add a source</h2></div><p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">Create the connection first, then authorize it in the provider's own secure sign-in window.</p></div><div className="hidden items-center gap-1.5 text-[11px] font-semibold text-emerald-700 sm:flex"><ShieldCheck size={14} />Encrypted credentials</div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Object.entries(providerInfo).map(([system, provider]) => <button key={system} type="button" onClick={() => setForm(current => ({ ...current, system }))} className={`group rounded-2xl border p-4 text-left transition ${form.system === system ? 'border-info/50 bg-info/8 shadow-[0_8px_24px_rgb(var(--info)/.1)]' : 'border-border bg-canvas hover:border-info/30 hover:bg-surface-soft'}`}><span className="flex items-start justify-between gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${form.system === system ? 'bg-info text-primary-foreground' : 'bg-info/10 text-info'}`}>{system === 'sharepoint' ? <FolderSync size={18} /> : <HardDrive size={18} />}</span><span className={`grid h-5 w-5 place-items-center rounded-full border ${form.system === system ? 'border-info bg-info text-primary-foreground' : 'border-border text-transparent'}`}><Check size={12} /></span></span><span className="mt-3 block text-sm font-bold text-foreground">{provider.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{provider.description}</span></button>)}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row"><input required className="field min-w-0 flex-1" placeholder="Connection name, e.g. Engineering Drive" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /><button disabled={busy === 'create' || !form.name.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_rgb(var(--shadow)/.18)] transition hover:-translate-y-0.5 hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} />{busy === 'create' ? 'Creating source…' : 'Create source'}</button></div>
          </form>

          <section className="rounded-[24px] border border-border bg-surface shadow-[0_14px_36px_rgb(var(--shadow)/.06)]">
            <div className="border-b border-border-soft p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><div className="flex items-center gap-2"><Settings2 size={17} className="text-info" /><h2 className="text-base font-bold text-foreground">Your sources</h2><span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{items.length}</span></div><p className="mt-1 text-xs text-muted-foreground">Operate each connection without leaving this view.</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative min-w-0 sm:w-64"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search connectors" className="field h-10 w-full pl-9 pr-9 text-xs" placeholder="Search sources…" value={search} onChange={event => setSearch(event.target.value)} />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-surface-soft"><X size={14} /></button>}</label><button type="button" onClick={() => void refreshConnectors(true)} disabled={refreshing || loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-foreground transition hover:bg-surface-soft disabled:opacity-50"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Refreshing' : 'Refresh'}</button></div></div>
              <div className="mt-5 flex max-w-full gap-1 overflow-x-auto rounded-xl bg-canvas p-1" role="tablist" aria-label="Filter connector status">{([['all', 'All', counts.total], ['healthy', 'Healthy', counts.healthy], ['needs_action', 'Action required', counts.needs_action], ['attention', 'Attention', counts.attention]] as [Filter, string, number][]).map(([value, label, count]) => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${filter === value ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === value ? 'bg-info/10 text-info' : 'bg-surface-soft text-muted-foreground'}`}>{count}</span></button>)}</div>
            </div>
            <div className="p-4 sm:p-5">{loading ? <ConnectorSkeletons /> : visibleItems.length === 0 ? <EmptyConnectors hasItems={items.length > 0} onReset={() => { setSearch(''); setFilter('all') }} /> : <div className="space-y-4">{visibleItems.map(item => <ConnectorCard key={item.id} item={item} provider={getProvider(item.system)} state={getConnectorState(item)} open={openId === item.id} scopes={scopes[item.id] || []} jobs={jobs[item.id] || []} preview={previews[item.id]} sourceTree={sourceTrees[item.id]} readme={readmes[item.id]} sourceMapOpen={sourceMapOpenId === item.id} activityOpen={activityOpenId === item.id} activityLoading={jobLoadingId === item.id} departmentOpen={departmentOpenId === item.id} departments={departments} departmentIds={departmentDrafts[item.id] || item.department_ids || []} busy={busy} scopeLoading={scopeLoadingId === item.id} aclPrincipals={aclPrincipals[item.id] || []} aclOpen={aclOpenId === item.id} aclLoading={aclLoadingId === item.id} accessGroups={accessGroups} onAuthorize={authorize} onSync={sync} onPreview={loadPreview} onToggleSourceMap={loadSourceMap} onToggleScopes={loadScopes} onRefreshScopes={itemToRefresh => void loadScopes(itemToRefresh, true)} onToggleActivity={loadJobs} onToggleDepartments={toggleDepartments} onSaveDepartments={saveDepartments} onSaveScopes={saveScopes} onChangeMode={changeMode} onEnableWebhooks={enableWebhooks} onToggleAcl={loadAcl} onSaveAclMapping={saveAclMapping} />)}</div>}</div>
          </section>
        </div>

        <aside className="hidden space-y-5 xl:block">
          <div className="rounded-[24px] border border-info/20 bg-gradient-to-br from-info/10 via-surface to-cyan/8 p-5 shadow-[0_14px_36px_rgb(var(--shadow)/.06)]"><div className="flex items-center gap-2 text-info"><Sparkles size={17} /><span className="text-[11px] font-bold uppercase tracking-[.14em]">Designed for clarity</span></div><h2 className="mt-4 text-lg font-bold text-foreground">A calmer way to manage knowledge sources.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Search, filter, and act on the exact source that needs you. Location discovery is loaded only when you open it, so the overview stays quick.</p><div className="mt-5 space-y-3 text-xs text-muted-foreground"><FeatureLine icon={<Search size={14} />} text="Instant search across all connections" /><FeatureLine icon={<ShieldCheck size={14} />} text="Clear authorization and health states" /><FeatureLine icon={<FolderOpen size={14} />} text="Precise folder and library selection" /></div></div>
          <div className="rounded-[24px] border border-border bg-surface p-5 shadow-[0_14px_36px_rgb(var(--shadow)/.06)]"><div className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-600" /><h2 className="text-sm font-bold text-foreground">Safe by default</h2></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Authorization happens in the provider's own window. Only the locations you select are synchronized into the Knowledge Base.</p><div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Provider-managed access</div></div>
        </aside>
      </section>
    </main>
  )
}

function MetricCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: number; detail: string; tone: 'info' | 'success' | 'warning' | 'danger' }) {
  const tones = { info: 'bg-info/10 text-info', success: 'bg-emerald-500/10 text-emerald-700', warning: 'bg-amber-500/10 text-amber-700', danger: 'bg-rose-500/10 text-rose-700' }
  return <div className="metric-spark interactive-lift rounded-2xl border border-border bg-surface p-4 shadow-[0_10px_26px_rgb(var(--shadow)/.05)]"><div className="flex items-start justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>{icon}</span><span className="font-display text-2xl font-extrabold text-foreground">{value}</span></div><p className="mt-4 text-xs font-bold text-foreground">{label}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div>
}

function FeatureLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-2.5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-info shadow-sm">{icon}</span><span>{text}</span></div>
}

/** External link that only links out when the URL is http(s); unsafe values render as plain spans. */
function SafeExternalLink({ url, children, ...anchorProps }: { url: string; children: React.ReactNode } & Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'aria-label' | 'className' | 'onClick'>) {
  const href = safeExternalUrl(url)
  if (href) return <a href={href} target="_blank" rel="noreferrer" {...anchorProps}>{children}</a>
  return <span {...anchorProps}>{children}</span>
}

function ConnectorSkeletons() {
  return <div className="space-y-4" aria-label="Loading connectors"><div className="h-52 animate-pulse rounded-2xl bg-surface-soft" /><div className="h-52 animate-pulse rounded-2xl bg-surface-soft" /></div>
}

function EmptyConnectors({ hasItems, onReset }: { hasItems: boolean; onReset: () => void }) {
  return <div className="rounded-2xl border border-dashed border-border p-10 text-center sm:p-14"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-info/10 text-info">{hasItems ? <Search size={20} /> : <Cloud size={20} />}</span><h3 className="mt-4 text-sm font-bold text-foreground">{hasItems ? 'No sources match this view' : 'Your source workspace is ready'}</h3><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{hasItems ? 'Try another search or reset the filters to see every connection.' : 'Create your first Google Drive or SharePoint connection above to start bringing documents in.'}</p>{hasItems && <button type="button" onClick={onReset} className="mt-5 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-soft">Reset view</button>}</div>
}

function ConnectorCard({ item, provider, state, open, scopes, jobs, preview, sourceTree, readme, sourceMapOpen, activityOpen, activityLoading, departmentOpen, departments, departmentIds, busy, scopeLoading, aclPrincipals, aclOpen, aclLoading, accessGroups, onAuthorize, onSync, onPreview, onToggleSourceMap, onToggleScopes, onRefreshScopes, onToggleActivity, onToggleDepartments, onSaveDepartments, onSaveScopes, onChangeMode, onEnableWebhooks, onToggleAcl, onSaveAclMapping }: {
  item: Connector
  provider: { label: string; description: string }
  state: ConnectorState
  open: boolean
  scopes: Scope[]
  jobs: ConnectorJob[]
  preview?: ConnectorPreview
  sourceTree?: SourceTree
  readme?: ConnectorReadme
  sourceMapOpen: boolean
  activityOpen: boolean
  activityLoading: boolean
  departmentOpen: boolean
  departments: Department[]
  departmentIds: string[]
  busy: string | null
  scopeLoading: boolean
  aclPrincipals: ConnectorAclPrincipal[]
  aclOpen: boolean
  aclLoading: boolean
  accessGroups: AccessGroup[]
  onAuthorize: (item: Connector) => void
  onSync: (item: Connector) => void
  onPreview: (item: Connector) => void
  onToggleSourceMap: (item: Connector) => void
  onToggleScopes: (item: Connector) => void
  onRefreshScopes: (item: Connector) => void
  onToggleActivity: (item: Connector) => void
  onToggleDepartments: (item: Connector) => void
  onSaveDepartments: (item: Connector, departmentIds: string[]) => Promise<void>
  onSaveScopes: (item: Connector, selected: string[]) => Promise<void>
  onChangeMode: (item: Connector, mode: string) => void
  onEnableWebhooks: (item: Connector) => void
  onToggleAcl: (item: Connector) => void
  onSaveAclMapping: (item: Connector, principal: ConnectorAclPrincipal, accessGroupId: string) => Promise<void>
}) {
  const status = stateInfo[state]
  const selectedCount = scopes.filter(scope => scope.selected).length
  const primaryBusy = busy === `authorize:${item.id}` || busy === `sync:${item.id}` || busy === `preview:${item.id}` || busy === `source-map:${item.id}`
  const itemBusy = Boolean(busy?.endsWith(`:${item.id}`))
  const connectorDepartments = departments.filter(department => department.company_domain === item.company_domain)
  const selectedDepartmentNames = departmentIds.map(id => connectorDepartments.find(department => department.id === id)?.name).filter(Boolean) as string[]
  return <article className={`overflow-hidden rounded-[22px] border bg-surface shadow-[0_10px_28px_rgb(var(--shadow)/.045)] transition ${open ? 'border-info/35 shadow-[0_16px_34px_rgb(var(--info)/.08)]' : 'border-border'}`}>
    <div className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${item.system === 'sharepoint' ? 'bg-cyan/10 text-cyan-700' : 'bg-info/10 text-info'}`}>{item.system === 'sharepoint' ? <FolderSync size={20} /> : <HardDrive size={20} />}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-bold text-foreground">{item.name}</h3><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${status.className}`}>{status.icon}{status.label}</span></div><p className="mt-1 text-xs text-muted-foreground">{provider.label}{item.company_domain ? ` · ${item.company_domain}` : ''}</p><p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">{status.description}. {item.authorized ? (selectedCount ? `${selectedCount} location${selectedCount === 1 ? '' : 's'} selected for sync.` : 'Choose at least one location to control what is indexed.') : 'Complete authorization to discover available locations.'}</p></div></div><div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">{!item.authorized && <button type="button" onClick={() => onAuthorize(item)} disabled={primaryBusy || itemBusy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-xs font-bold text-primary-foreground shadow-[0_7px_18px_rgb(var(--shadow)/.16)] transition hover:-translate-y-0.5 hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50">{busy === `authorize:${item.id}` ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}{busy === `authorize:${item.id}` ? 'Opening secure sign-in…' : 'Authorize source'}</button>}{item.authorized && <><button type="button" onClick={() => onSync(item)} disabled={primaryBusy || itemBusy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-xs font-bold text-primary-foreground shadow-[0_7px_18px_rgb(var(--shadow)/.16)] transition hover:-translate-y-0.5 hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50">{busy === `sync:${item.id}` ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}{busy === `sync:${item.id}` ? 'Queueing sync…' : 'Sync now'}</button><button type="button" onClick={() => onToggleSourceMap(item)} disabled={primaryBusy || itemBusy} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${sourceMapOpen ? 'border-info/35 bg-info/10 text-info' : 'border-border text-foreground hover:bg-surface-soft'}`}>{busy === `source-map:${item.id}` ? <Loader2 size={15} className="animate-spin" /> : <FolderTree size={15} />}{sourceMapOpen ? 'Close source map' : 'Source map'}</button>{item.system === 'sharepoint' && <button type="button" onClick={() => onPreview(item)} disabled={primaryBusy || itemBusy || selectedCount === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-info/30 px-4 text-xs font-bold text-info transition hover:bg-info/10 disabled:cursor-not-allowed disabled:opacity-50">{busy === `preview:${item.id}` ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}{busy === `preview:${item.id}` ? 'Previewing…' : 'Preview files'}</button>}<button type="button" onClick={() => onToggleScopes(item)} disabled={scopeLoading || itemBusy} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${open ? 'border-info/35 bg-info/10 text-info' : 'border-border text-foreground hover:bg-surface-soft'}`}>{scopeLoading ? <Loader2 size={15} className="animate-spin" /> : <FolderOpen size={15} />}{open ? 'Close locations' : 'Manage locations'}<ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} /></button>{item.system === 'sharepoint' && <button type="button" onClick={() => onToggleAcl(item)} disabled={aclLoading || itemBusy} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${aclOpen ? 'border-cyan/35 bg-cyan/10 text-cyan-800' : 'border-border text-foreground hover:bg-surface-soft'}`}>{aclLoading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}{aclOpen ? 'Close ACL' : 'Review ACL'}</button>}</>}</div></div>
      {item.last_error && <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/8 px-3.5 py-3 text-xs text-amber-800"><AlertCircle size={15} className="mt-0.5 shrink-0" /><span><span className="font-bold">Latest sync notice:</span> {item.last_error}</span></div>}
      <div className="mt-5 grid gap-3 border-t border-border-soft pt-5 sm:grid-cols-2"><div className="rounded-xl bg-canvas px-3.5 py-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Last activity</p><p className="mt-1.5 text-xs font-semibold text-foreground">{formatDate(item.last_sync)}</p></div>{item.authorized ? <div className="rounded-xl bg-canvas px-3.5 py-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Automation</p><div className="mt-1.5 flex items-center gap-2"><Select aria-label={`Sync schedule for ${item.name}`} className="h-7 min-w-0 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-foreground outline-none" value={item.sync_mode} onChange={event => onChangeMode(item, event.target.value)} disabled={itemBusy}><option value="daily">Daily sync</option><option value="on_update">On update</option><option value="manual">Manual only</option></Select>{item.sync_mode === 'on_update' && <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-info">{item.webhook_enabled ? <><Check size={12} />Live</> : <button type="button" onClick={() => onEnableWebhooks(item)} disabled={itemBusy} className="font-semibold underline decoration-dotted underline-offset-2 hover:no-underline disabled:opacity-50">Enable alerts</button>}</span>}</div></div> : <div className="rounded-xl bg-canvas px-3.5 py-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Next step</p><p className="mt-1.5 text-xs font-semibold text-foreground">Authorize to unlock sync controls</p></div>}</div>
      {item.authorized && <button type="button" onClick={() => onToggleActivity(item)} disabled={activityLoading || itemBusy} className="mt-4 inline-flex items-center gap-2 rounded-lg px-1 text-xs font-bold text-info transition hover:text-info/75 disabled:opacity-50"><History size={14} />{activityLoading ? 'Loading sync activity…' : activityOpen ? 'Hide sync activity' : 'View sync activity'}{jobs.length > 0 && <span className="rounded-full bg-info/10 px-1.5 py-0.5 text-[10px]">{jobs.length}</span>}</button>}
      <div className="mt-3 flex flex-col justify-between gap-2 rounded-xl border border-info/15 bg-info/5 px-3.5 py-3 sm:flex-row sm:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Default draft routing</p><p className="mt-1 text-xs font-semibold text-foreground">{selectedDepartmentNames.length ? selectedDepartmentNames.join(' · ') : item.department_names?.length ? item.department_names.join(' · ') : 'Not configured — reviewers may not see this draft'}</p></div><button type="button" onClick={() => onToggleDepartments(item)} disabled={itemBusy} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-info/25 bg-surface px-3 py-2 text-xs font-bold text-info hover:bg-info/10 disabled:opacity-50"><Settings2 size={13} />{departmentOpen ? 'Close routing' : 'Set departments'}</button></div>
    </div>
    {departmentOpen && <DepartmentPicker departments={connectorDepartments} selectedIds={departmentIds} busy={busy === `departments:${item.id}`} onSave={selected => void onSaveDepartments(item, selected)} />}
    {activityOpen && <SyncActivity jobs={jobs} loading={activityLoading} />}
    {open && <ScopePicker item={item} scopes={scopes} busy={busy === `scopes:${item.id}`} loading={scopeLoading} onRefresh={() => onRefreshScopes(item)} onSave={selected => onSaveScopes(item, selected)} />}
    {sourceMapOpen && <SourceMapPanel tree={sourceTree} readme={readme} loading={busy === `source-map:${item.id}`} />}
    {preview && <PreviewPanel preview={preview} />}
    {aclOpen && <AclMappingPanel item={item} principals={aclPrincipals} groups={accessGroups} loading={aclLoading} busy={busy} onSave={(principal, groupId) => void onSaveAclMapping(item, principal, groupId)} />}
  </article>
}

function SourceMapPanel({ tree, readme, loading }: { tree?: SourceTree; readme?: ConnectorReadme; loading: boolean }) {
  if (loading && !tree) return <div className="border-t border-info/15 bg-info/5 px-5 py-5 sm:px-6"><div className="h-28 animate-pulse rounded-xl bg-surface-soft" /></div>
  if (!tree) return <div className="border-t border-info/15 bg-info/5 px-5 py-5 text-xs text-muted-foreground sm:px-6">No source map is available yet. Run a sync after selecting a location.</div>
  return <div className="border-t border-info/15 bg-gradient-to-b from-info/5 to-surface px-5 py-5 sm:px-6"><div className="flex flex-col gap-4 lg:flex-row"><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><div><h4 className="flex items-center gap-2 text-sm font-bold text-foreground"><FolderTree size={16} className="text-info" />Source map</h4><p className="mt-1 text-xs text-muted-foreground">{tree.files_indexed} active file{tree.files_indexed === 1 ? '' : 's'} observed in the selected source locations.</p></div><span className="rounded-full bg-info/10 px-2.5 py-1 text-[10px] font-bold text-info">Read only</span></div><div className="mt-4 space-y-3">{tree.scopes.map(scope => <div key={scope.id} className="rounded-xl border border-border bg-surface p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-foreground">{scope.display_name}</span><span className="text-[10px] text-muted-foreground">{scope.nodes.length} item{scope.nodes.length === 1 ? '' : 's'}</span></div>{scope.nodes.length ? <div className="mt-2 space-y-1">{scope.nodes.slice(0, 80).map(node => <div key={node.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] hover:bg-surface-soft"><span className={node.is_folder ? 'text-info' : 'text-muted-foreground'}>{node.is_folder ? '▸' : '•'}</span><span className="min-w-0 flex-1 truncate">{node.name}</span><span className="shrink-0 text-[10px] text-muted-foreground">{node.state}</span></div>)}</div> : <p className="mt-2 text-[11px] text-muted-foreground">No synced items observed yet.</p>}</div>)}</div></div>{readme && <aside className="min-w-0 rounded-xl border border-border bg-canvas p-3 lg:w-[24rem]"><div className="flex items-center justify-between gap-2"><h4 className="text-xs font-bold text-foreground">Generated README</h4><span className="text-[10px] text-muted-foreground">{new Date(readme.generated_at).toLocaleString()}</span></div><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-muted-foreground">{readme.markdown}</pre></aside>}</div></div>
}

function AclMappingPanel({ item, principals, groups, loading, busy, onSave }: { item: Connector; principals: ConnectorAclPrincipal[]; groups: AccessGroup[]; loading: boolean; busy: string | null; onSave: (principal: ConnectorAclPrincipal, accessGroupId: string) => void }) {
  const companyGroups = groups.filter(group => group.company_domain === item.company_domain)
  if (loading && !principals.length) return <div className="border-t border-cyan/15 bg-gradient-to-b from-cyan/5 to-surface px-5 py-5 sm:px-6"><div className="h-28 animate-pulse rounded-xl bg-surface-soft" /></div>
  if (!principals.length) return <div className="border-t border-cyan/15 bg-gradient-to-b from-cyan/5 to-surface px-5 py-5 text-xs text-muted-foreground sm:px-6"><div className="flex items-center gap-2 text-sm font-bold text-foreground"><ShieldCheck size={16} className="text-cyan-700" />Provider ACL principals</div><p className="mt-2">No active provider permission principals have been observed yet. Run a sync after selecting a SharePoint location.</p></div>
  return <div className="border-t border-cyan/15 bg-gradient-to-b from-cyan/5 to-surface px-5 py-5 sm:px-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h4 className="flex items-center gap-2 text-sm font-bold text-foreground"><ShieldCheck size={16} className="text-cyan-700" />Provider ACL principals</h4><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Unmapped principals fail closed and block approval. Choose an internal access group only after confirming the provider permission semantics.</p></div><span className="rounded-full bg-cyan/10 px-2.5 py-1 text-[10px] font-bold text-cyan-800">{principals.filter(principal => principal.mapping_status === 'unmapped').length} unresolved</span></div><div className="mt-4 space-y-2">{principals.map(principal => { const isGroup = principal.principal_type === 'group' || principal.principal_type === 'siteGroup'; const mappingBusy = busy === `acl:${item.id}:${principal.principal_id}`; return <div key={`${principal.principal_type}:${principal.principal_id}`} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-canvas px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{principal.principal_type}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${principal.mapping_status === 'mapped' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>{principal.mapping_status === 'mapped' ? 'Mapped' : 'Unmapped'}</span></div><p className="mt-2 break-all font-mono text-[11px] text-foreground">{principal.external_group_name || principal.principal_id}</p><p className="mt-1 text-[10px] text-muted-foreground">Provider role: {principal.roles.join(', ') || 'unspecified'}{principal.access_group_name ? ` · Internal group: ${principal.access_group_name}` : ''}</p></div>{isGroup ? <Select aria-label={`Internal access group for provider principal ${principal.principal_id}`} className="field min-w-0 text-xs sm:w-64" value={principal.access_group_id || ''} disabled={mappingBusy || !companyGroups.length} onChange={event => { if (event.target.value) onSave(principal, event.target.value) }}><option value="">Select internal group…</option>{companyGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</Select> : <span className="text-[11px] text-muted-foreground">{principal.mapping_status === 'mapped' ? 'Linked through Entra identity' : 'Requires an approved provider identity mapping'}</span>}</div> })}</div>{!companyGroups.length && <p className="mt-3 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">No internal access groups are available for this connector company.</p>}</div>
}

function PreviewPanel({ preview }: { preview: ConnectorPreview }) {
  return <div className="border-t border-info/15 bg-gradient-to-b from-info/5 to-surface px-5 py-5 sm:px-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h4 className="flex items-center gap-2 text-sm font-bold text-foreground"><Search size={16} className="text-info" />Read-only source preview</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">{preview.files_returned} file{preview.files_returned === 1 ? '' : 's'} found across {preview.scopes} selected location{preview.scopes === 1 ? '' : 's'}. No drafts or articles were created.</p></div><span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Writes performed: {preview.writes_performed ? 'Yes' : 'No'}</span></div>
    {preview.files.length ? <div className="mt-4 space-y-1.5">{preview.files.slice(0, 12).map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"><FileText size={13} className="shrink-0 text-info" /><span className="min-w-0 flex-1 truncate font-semibold text-foreground">{file.name}</span><span className="shrink-0 text-[10px] text-muted-foreground">{file.scope || 'Selected location'}</span>{file.web_url && <SafeExternalLink url={file.web_url} aria-label={`Open ${file.name}`} className="shrink-0 rounded p-1 text-info hover:bg-info/10"><ExternalLink size={12} /></SafeExternalLink>}</div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">No active files were returned by the provider.</p>}
    {(preview.truncated || preview.errors?.length) && <div className="mt-3 space-y-1 text-[11px] text-amber-700">{preview.truncated && <p>Preview is limited to the first 50 files.</p>}{preview.errors?.map(error => <p key={error}>{error}</p>)}</div>}
  </div>
}

function DepartmentPicker({ departments, selectedIds, busy, onSave }: { departments: Department[]; selectedIds: string[]; busy: boolean; onSave: (selected: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(selectedIds)
  useEffect(() => setSelected(selectedIds), [selectedIds])
  return <div className="border-t border-info/15 bg-gradient-to-b from-info/5 to-surface px-5 py-5 sm:px-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h4 className="flex items-center gap-2 text-sm font-bold text-foreground"><Settings2 size={16} className="text-info" />Default draft departments</h4><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">New files from this connector become Pending Drafts in these departments. The first selected department is the primary department; you can still change the selection during review.</p></div><button type="button" onClick={() => onSave(selected)} disabled={busy} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-3 text-xs font-bold text-primary-foreground disabled:opacity-50"><Save size={14} />{busy ? 'Saving…' : 'Save routing'}</button></div>{departments.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{departments.map(department => { const checked = selected.includes(department.id); return <label key={department.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-xs transition ${checked ? 'border-info/35 bg-info/8' : 'border-border bg-surface hover:border-info/25 hover:bg-surface-soft'}`}><input type="checkbox" className="sr-only" checked={checked} onChange={event => setSelected(current => event.target.checked ? [...current, department.id] : current.filter(id => id !== department.id))} /><span className={`grid h-5 w-5 place-items-center rounded-md border ${checked ? 'border-info bg-info text-primary-foreground' : 'border-border bg-canvas text-transparent'}`}><Check size={12} /></span><span className="font-semibold text-foreground">{department.name}</span></label>})}</div> : <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">No active departments are available for this company.</p>}<div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground"><span>{selected.length ? `${selected.length} department${selected.length === 1 ? '' : 's'} selected` : 'No default department selected'}</span>{selected.length > 0 && <button type="button" onClick={() => setSelected([])} className="font-semibold text-info hover:underline">Clear routing</button>}</div></div>
}

function SyncActivity({ jobs, loading }: { jobs: ConnectorJob[]; loading: boolean }) {
  if (loading && !jobs.length) return <div className="border-t border-border-soft bg-canvas px-5 py-5 sm:px-6"><div className="h-24 animate-pulse rounded-xl bg-surface-soft" /></div>
  if (!jobs.length) return <div className="border-t border-border-soft bg-canvas px-5 py-5 text-xs text-muted-foreground">No sync runs yet. The result of the next sync will appear here.</div>
  return <div className="border-t border-border-soft bg-canvas px-5 py-5 sm:px-6"><div className="flex items-center justify-between gap-3"><div><h4 className="flex items-center gap-2 text-sm font-bold text-foreground"><History size={16} className="text-info" />Sync activity</h4><p className="mt-1 text-[11px] text-muted-foreground">A transparent record of the latest provider changes.</p></div><span className="text-[10px] font-semibold text-muted-foreground">Newest first</span></div><div className="mt-4 space-y-3">{jobs.map(job => { const summary = job.summary || {}; const imported = Number(summary.imported || 0); const updated = Number(summary.updated || 0); const deleted = Number(summary.deleted || 0); const changed = imported + updated + deleted; const statusClass = job.status === 'completed' ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700' : job.status === 'failed' ? 'border-rose-400/25 bg-rose-500/10 text-rose-700' : 'border-sky-400/25 bg-sky-500/10 text-sky-700'; return <div key={job.id} className="rounded-2xl border border-border bg-surface p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClass}`}>{job.status === 'running' ? 'Syncing now' : job.status}</span><span className="text-[11px] text-muted-foreground">Started {formatDate(job.created_at)}</span></div>{job.status === 'completed' && <p className="mt-2 text-xs font-semibold text-foreground">{changed ? `${changed} file${changed === 1 ? '' : 's'} changed` : 'No file content changed'}{summary.permissions_updated ? ` · ${summary.permissions_updated} permission update${summary.permissions_updated === 1 ? '' : 's'}` : ''}</p>}{job.status === 'running' || job.status === 'queued' ? <p className="mt-2 text-xs font-semibold text-info">The worker is checking selected locations…</p> : null}{job.status === 'failed' && <p className="mt-2 text-xs text-rose-700">{job.last_error || 'The sync failed without a detailed error.'}</p>}</div>{job.completed_at && <span className="text-[11px] text-muted-foreground">Finished {formatDate(job.completed_at)}</span>}</div>{job.status === 'completed' && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><ActivityStat label="Locations" value={summary.scope_count || 0} /><ActivityStat label="Checked" value={summary.files_seen || 0} /><ActivityStat label="Imported / updated" value={imported + updated} /><ActivityStat label="Removed" value={deleted} /></div>}{job.status === 'completed' && summary.items && summary.items.length > 0 && <div className="mt-4 border-t border-border-soft pt-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Files in this run</p><div className="mt-2 space-y-1">{summary.items.slice(0, 12).map((entry, index) => <div key={`${job.id}-${entry.name}-${index}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-canvas"><FileText size={13} className="shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-foreground">{entry.name}</span><span className="shrink-0 text-[10px] font-semibold capitalize text-muted-foreground">{entry.action}</span>{entry.web_url && <SafeExternalLink url={entry.web_url} aria-label={`Open ${entry.name}`} className="shrink-0 rounded p-1 text-info hover:bg-info/10"><ExternalLink size={12} /></SafeExternalLink>}</div>)}</div>{summary.items.length >= 200 && <p className="mt-2 text-[10px] text-muted-foreground">Showing the first 200 files from this run.</p>}</div>}{job.status === 'completed' && (!summary.items || summary.items.length === 0) && <p className="mt-4 flex items-center gap-2 border-t border-border-soft pt-3 text-xs text-muted-foreground"><CheckCircle2 size={14} className="text-emerald-600" />No individual file changes were reported by the provider.</p>}</div> })}</div></div>
}

function ActivityStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-canvas px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-muted">{label}</p><p className="mt-1 text-sm font-extrabold text-foreground">{value}</p></div>
}

function ScopePicker({ item, scopes, busy, loading, onRefresh, onSave }: { item: Connector; scopes: Scope[]; busy: boolean; loading: boolean; onRefresh: () => void; onSave: (selected: string[]) => Promise<void> }) {
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    setSelected(scopes.filter(scope => scope.selected).map(scope => scope.external_scope_id))
  }, [scopes])

  const visibleScopes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return scopes
    return scopes.filter(scope => [scope.display_name, scope.scope_type, scope.config?.location_label, scope.config?.site_name, scope.config?.drive_name].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery))
  }, [query, scopes])

  const visibleIds = visibleScopes.map(scope => scope.external_scope_id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id))
  const originalSelected = scopes.filter(scope => scope.selected).map(scope => scope.external_scope_id).sort().join('|')
  const currentSelected = [...selected].sort().join('|')
  const hasChanges = originalSelected !== currentSelected
  const providerName = providerInfo[item.system]?.label || item.system

  const toggleVisible = () => setSelected(current => allVisibleSelected ? current.filter(id => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds])))

  return (<div className="border-t border-info/15 bg-gradient-to-b from-info/5 to-surface px-5 py-5 sm:px-6">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
      <div>
        <div className="flex items-center gap-2"><FolderOpen size={17} className="text-info" /><h4 className="text-sm font-bold text-foreground">Sync locations</h4><span className="rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-bold text-info">{selected.length} selected</span></div>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Select the {providerName} folders or libraries that should be indexed. Everything else stays outside the Knowledge Base.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={onRefresh} disabled={loading || busy} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:bg-surface-soft disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{loading ? 'Discovering…' : 'Refresh locations'}</button>
        <button type="button" disabled={loading || busy || !scopes.length || !hasChanges} onClick={() => void onSave(selected)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-ink px-3 text-xs font-bold text-primary-foreground disabled:opacity-50"><Save size={14} />{busy ? 'Saving…' : hasChanges ? 'Save selection' : 'Saved'}</button>
      </div>
    </div>
    {loading ? <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="h-20 animate-pulse rounded-xl bg-surface-soft" /><div className="h-20 animate-pulse rounded-xl bg-surface-soft" /><div className="h-20 animate-pulse rounded-xl bg-surface-soft" /></div> : !scopes.length ? <div className="mt-5 rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center"><FolderSync size={20} className="mx-auto text-muted-foreground" /><p className="mt-2 text-xs font-semibold text-foreground">No locations found</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Check the provider permission, then refresh locations to try again.</p></div> : <><div className="mt-5 flex flex-col gap-2 sm:flex-row"><label className="relative min-w-0 flex-1"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input aria-label={`Search locations for ${item.name}`} className="field h-9 w-full pl-9 pr-9 text-xs" placeholder="Search site, library, or folder…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear location search" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-surface-soft"><X size={13} /></button>}</label><button type="button" onClick={toggleVisible} disabled={!visibleScopes.length} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:bg-surface-soft disabled:opacity-50">{allVisibleSelected ? <><X size={13} />Clear visible</> : <><Check size={13} />Select visible</>}</button></div><p className="mt-3 text-[11px] text-muted-foreground">Showing {visibleScopes.length} of {scopes.length} locations{hasChanges && <span className="ml-2 font-semibold text-info">· Unsaved changes</span>}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{visibleScopes.map(scope => { const isSelected = selected.includes(scope.external_scope_id); const typeLabel = scope.scope_type.includes('folder') ? 'Folder' : scope.scope_type.includes('library') ? 'Document library' : 'Drive'; return <label key={scope.external_scope_id} className={`group flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${isSelected ? 'border-info/35 bg-info/8' : 'border-border bg-surface hover:border-info/25 hover:bg-surface-soft'}`}><input className="sr-only" type="checkbox" checked={isSelected} onChange={event => setSelected(current => event.target.checked ? [...current, scope.external_scope_id] : current.filter(id => id !== scope.external_scope_id))} /><span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${isSelected ? 'border-info bg-info text-white' : 'border-border bg-canvas text-transparent group-hover:border-info/40'}`}><Check size={12} /></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="block break-words text-xs font-bold leading-5 text-foreground">{scope.config?.location_label || scope.display_name}</span>{scope.config?.web_url && <SafeExternalLink url={scope.config.web_url} aria-label={`Open ${scope.display_name} in ${providerName}`} onClick={event => event.stopPropagation()} className="shrink-0 rounded-md p-1 text-info opacity-70 hover:bg-info/10 hover:opacity-100"><ArrowUpRight size={14} /></SafeExternalLink>}</span><span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin size={11} />{typeLabel}</span>{scope.config?.web_url && <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-info">Open in {providerName}<ExternalLink size={11} /></span>}</span></label> })}</div>{!visibleScopes.length && <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No locations match “{query}”.</div>}</>}
  </div>)
}

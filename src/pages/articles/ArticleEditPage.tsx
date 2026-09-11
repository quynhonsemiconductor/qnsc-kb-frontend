import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useBlocker } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, Save, X } from 'lucide-react'
import { getArticle, createArticle, updateArticle } from '../../api/articles'
import { listDepartments, listUsers } from '../../api/auth'
import { useAuth } from '../../auth/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import { useLanguage } from '../../i18n/LanguageProvider'
import { apiErrorDetail, apiErrorStatus } from '../../lib/error-handler'
import { Select } from '../../components/ui/Select'
import { FloatingPanel } from '../../components/ui/FloatingPanel'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { toDateInputValue } from '../../lib/formatters'
import { ARTICLE_TYPES, SENSITIVITY_LEVELS } from '../../utils/articleTaxonomy'

const ARTICLE_TEMPLATE = '# Purpose\n\n## Summary\n\n## Procedure or details\n\n## Ownership and review\n'
type Department = { id: string; name: string; company_domain: string; active: boolean }
type ManagedUser = { id: string; name: string; email: string; company_domain: string; active: boolean; dept?: string | null }

function DepartmentPicker({ value, options, onChange }: { value: string[]; options: Department[]; onChange: (value: string[]) => void }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const selected = value.map(id => options.find(item => item.id === id)).filter(Boolean) as Department[]
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id])

  return <div className="relative">
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label className="block text-xs font-semibold text-slate-400">{t('editor.departments')}</label>
      <span className="text-caption font-semibold text-slate-500">{selected.length} selected</span>
    </div>
    <button ref={anchorRef} type="button" aria-expanded={open} onClick={() => setOpen(current => !current)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 text-left text-xs text-foreground outline-none transition hover:border-brand-500/70 focus:border-brand-500">
      <span className={selected.length ? 'font-semibold text-foreground' : 'text-slate-500'}>{selected.length ? `${selected.length} department${selected.length === 1 ? '' : 's'} selected` : 'Choose departments'}</span>
      <ChevronDown size={15} className={`shrink-0 text-slate-500 transition ${open ? 'rotate-180 text-brand-400' : ''}`} />
    </button>
    <FloatingPanel anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} className="border-slate-700 bg-slate-900 p-1.5 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-2.5 py-2">
        <span className="text-caption font-bold uppercase tracking-[.14em] text-slate-500">{t('editor.visibility')}</span>
        {selected.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} className="text-caption font-semibold text-brand-400 hover:text-brand-300">Clear all</Button>}
      </div>
      <div className="py-1">
        {options.length ? options.map(item => { const checked = value.includes(item.id); return <button key={item.id} type="button" onClick={() => toggle(item.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-xs text-slate-200 transition hover:bg-slate-800">
          <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? 'border-brand-500 bg-brand-500 text-primary-foreground' : 'border-slate-600 bg-slate-950'}`}>{checked && <Check size={11} strokeWidth={3} />}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{item.name}</span>
          {checked && value[0] === item.id && <span className="text-caption font-semibold text-brand-400">Primary</span>}
        </button> }) : <p className="px-2.5 py-3 text-xs text-slate-500">No departments available.</p>}
      </div>
    </FloatingPanel>
    {selected.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{selected.map((item, index) => <Badge key={item.id} variant={index === 0 ? 'primary' : 'default'} size="sm" className="gap-1">
      {item.name}{index === 0 && <span className="text-caption uppercase tracking-wide opacity-70">primary</span>}
      <button type="button" aria-label={`Remove ${item.name}`} onClick={() => toggle(item.id)} className="rounded-full p-0.5 hover:bg-white/10"><X size={11} /></button>
    </Badge>)}</div>}
  </div>
}

export default function ArticleEditPage() {
  const { id } = useParams<{ id: string }>()
  const isEditMode = !!id
  const navigate = useNavigate()
  const dialog = useDialog()
  const { t } = useLanguage()

  // Form states
  const [title, setTitle] = useState('')
  const [bodyMd, setBodyMd] = useState('')
  const [dept, setDept] = useState('')
  const [departmentIds, setDepartmentIds] = useState<string[]>([])
  const [language, setLanguage] = useState('vi')
  const [status, setStatus] = useState('draft')
  const [tagsInput, setTagsInput] = useState('')
  const [nextReview, setNextReview] = useState('')
  // 'users' is never offered as a choice: the API rejects it (`^(public|department)$`).
  // It is still a value an article can HOLD — connector ACL sync and draft approval both
  // write it server-side — so it is loaded and preserved rather than coerced, because
  // rewriting such an article to 'department' would widen access from a named list of
  // people to a whole department.
  const [visibility, setVisibility] = useState<'public' | 'department' | 'users'>('department')
  // Reclassification, not routine editing: only sent to the API when the viewer holds
  // permission.manage, same gate the backend enforces. Loaded either way so the current
  // values are visible even to an editor who cannot change them.
  const [docType, setDocType] = useState<string>('SOP')
  const [sensitivity, setSensitivity] = useState<string>('internal')
  const [explicitUserIds, setExplicitUserIds] = useState<string[]>([])
  const [deniedUserIds, setDeniedUserIds] = useState<string[]>([])
  // The version this editor loaded. Sent back on save so the API can refuse to overwrite a
  // concurrent edit instead of silently discarding it.
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null)
  // Any edit to a field the user typed. Guards both exits; cleared once a save succeeds so
  // the post-save navigation is never itself treated as abandoning work.
  const [dirty, setDirty] = useState(false)

  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const canManageArticlePermissions = Boolean(user?.permissions?.includes('permission.manage'))
  const visibleUsers = users.filter(item => item.active && item.company_domain === user?.company_domain)

  // Read through refs by the load effect below: it must see current values without taking
  // them as dependencies, because re-running it would overwrite fields being edited.
  const userRef = useRef(user)
  userRef.current = user
  const canManageArticlePermissionsRef = useRef(canManageArticlePermissions)
  canManageArticlePermissionsRef.current = canManageArticlePermissions

  // Loads exactly once per article id. It used to also depend on the auth object's fields,
  // so any identity change to `user` refetched and reset every form field out from under
  // whoever was typing. Nothing in here needs to re-run when the viewer changes.
  useEffect(() => {
    let active = true
    const fetchSetupData = async () => {
      setLoading(true)
      try {
        const [departmentData, userData] = await Promise.all([
          listDepartments() as Promise<Department[]>,
          canManageArticlePermissionsRef.current ? listUsers() as Promise<ManagedUser[]> : Promise.resolve([]),
        ])
        if (!active) return
        setDepartments(departmentData)
        setUsers(userData)

        if (isEditMode && id) {
          const art = await getArticle(id)
          if (!active) return
          setTitle(art.title)
          setBodyMd(art.body_md)
          setDept(art.dept)
          setLoadedVersion(typeof art.version === 'number' ? art.version : null)
          const articleDepartmentIds = art.departments?.length ? art.departments.map((item: { id: string; name?: string }) => item.id) : departmentData.filter(item => item.name === art.dept).map(item => item.id)
          const primaryDepartmentId = art.departments?.find((item: { id: string; name?: string }) => item.name === art.dept)?.id || articleDepartmentIds[0]
          setDepartmentIds(primaryDepartmentId ? [primaryDepartmentId, ...articleDepartmentIds.filter((item: string) => item !== primaryDepartmentId)] : [])
          setLanguage(art.language || 'vi')
          setStatus(art.status)
          setVisibility(art.visibility || 'department')
          setDocType(art.type || 'SOP')
          setSensitivity(art.sensitivity || 'internal')
          setExplicitUserIds((art.explicit_user_ids || []).map((item: string) => String(item)))
          setDeniedUserIds((art.explicit_denied_user_ids || []).map((item: string) => String(item)))
          setTagsInput(art.tags ? art.tags.map((tag: { tag: string }) => tag.tag).join(', ') : '')
          if (art.next_review) {
            setNextReview(toDateInputValue(art.next_review))
          }
        } else {
          const viewer = userRef.current
          const defaultDepartment = departmentData.find(item => item.active && item.company_domain === viewer?.company_domain && item.name === viewer?.dept)
            || departmentData.find(item => item.active && item.company_domain === viewer?.company_domain)
          if (defaultDepartment) { setDept(defaultDepartment.name); setDepartmentIds([defaultDepartment.id]) }
        }
      } catch (err) {
        console.error(err)
        if (active) setError('Failed to load article metadata or details')
      } finally {
        if (active) setLoading(false)
      }
    }
    void fetchSetupData()
    // Leaving mid-load must not write state into an unmounted editor.
    return () => { active = false }
  }, [id, isEditMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!departmentIds.length) {
      setError('Select at least one department for this article')
      return
    }
    setSaving(true)

    // Parse comma separated tags
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const payload: Record<string, unknown> = {
      title,
      body_md: bodyMd,
      dept,
      department_ids: departmentIds,
      language,
      status,
      tags,
      next_review: nextReview ? new Date(nextReview).toISOString() : null
    }
    if (isEditMode && loadedVersion !== null) {
      // Optimistic concurrency: the API compares this against the stored version and
      // refuses the write on a mismatch rather than letting the last save win.
      payload.version = loadedVersion
    }
    if (!isEditMode || canManageArticlePermissions) {
      // A stored 'users' article is deliberately omitted rather than sent: the field only
      // accepts public|department, so sending it back would 422 and make such an article
      // unsavable, while omitting it makes the API keep the value it already has.
      if (visibility !== 'users') payload.visibility = visibility
      payload.explicit_user_ids = explicitUserIds
      payload.denied_user_ids = deniedUserIds
      if (isEditMode) {
        payload.type = docType
        payload.sensitivity = sensitivity
      }
    }

    try {
      if (isEditMode && id) {
        // The backend now answers with `workflow`: an editor who may approve their own
        // submission has the change published in the same request, so sending them to the
        // review queue would show an empty list and imply the edit was lost. Only a draft
        // that genuinely awaits review goes to the queue.
        const result = await updateArticle(id, payload)
        setDirty(false)
        navigate(result?.workflow === 'published' ? `/articles/${id}` : '/governance/pending-drafts')
      } else {
        await createArticle(payload)
        setDirty(false)
        navigate('/governance/pending-drafts')
      }
    } catch (err: unknown) {
      console.error(err)
      // A 409 means someone else saved first. Stay on the page with every field intact:
      // the user's unsaved text is the one copy that exists nowhere else.
      if (apiErrorStatus(err) === 409) {
        setError(t('editor.staleBody'))
        await dialog.alert(t('editor.staleBody'), { title: t('editor.staleTitle') })
      } else {
        setError(apiErrorDetail(err) || 'Failed to save article')
      }
    } finally {
      setSaving(false)
    }
  }

  // Reload and tab close. The browser shows its own generic prompt; assigning
  // returnValue is what still arms it across engines.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // In-app navigation. beforeunload never fires for a client-side route change, so the
  // router's own blocker is the only thing that can stop a back button from discarding
  // the draft. Saving clears `dirty` first, so a successful save never prompts.
  const blocker = useBlocker(dirty && !saving)

  // `dialog` and `t` are read through refs, and a flag keeps one prompt in flight.
  // DialogProvider rebuilds its api object on every render, so depending on that identity
  // re-ran this effect the instant the prompt opened, resolving the first confirm and
  // opening a replacement forever — the dialog could never be dismissed.
  const dialogRef = useRef(dialog)
  dialogRef.current = dialog
  const tRef = useRef(t)
  tRef.current = t
  const promptingRef = useRef(false)

  useEffect(() => {
    if (blocker.state !== 'blocked' || promptingRef.current) return
    promptingRef.current = true
    void (async () => {
      const translate = tRef.current
      const leave = await dialogRef.current.confirm(translate('editor.unsavedBody'), {
        title: translate('editor.unsavedTitle'),
        confirmLabel: translate('editor.unsavedLeave'),
        cancelLabel: translate('editor.unsavedStay'),
        tone: 'danger',
      })
      promptingRef.current = false
      if (leave) blocker.proceed()
      else blocker.reset()
    })()
  }, [blocker])

  const insertTemplate = async () => {
    if (bodyMd.trim() && !(await dialog.confirm('Replace the current body with the basic article template?', { title: 'Replace article body', confirmLabel: 'Replace', tone: 'info' }))) return
    setBodyMd(ARTICLE_TEMPLATE)
    setDirty(true)
  }

  const articleDepartments = departments.filter(item => (item.active && item.company_domain === user?.company_domain) || departmentIds.includes(item.id))

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500 mr-3" />
        <span>Preparing editor panel...</span>
      </div>
    )
  }

  return (
    <div className="page-shell page-stack">
      <div className="page-hero glass-panel soft-grid relative flex items-center justify-between overflow-hidden rounded-panel border border-border px-4 py-4 sm:px-6 sm:py-5">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(-1)}
          icon={<ArrowLeft size={16} />}
        >
          Back
        </Button>
        <h1 className="font-display text-xl font-extrabold text-foreground">
          {isEditMode ? 'Modify Article' : 'Submit New Article'}
        </h1>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Editor Body */}
        <div className="lg:col-span-2 space-y-5">
          {/* Title */}
          <Input
            label="Document Title"
            type="text"
            placeholder="e.g., Incident Response Playbook: Database Outages"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
            className="py-3"
            required
          />

          {/* Markdown Content */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-300">Body Markdown</label>
              <Button type="button" variant="ghost" size="sm" onClick={insertTemplate}>
                Insert basic template
              </Button>
            </div>
            <textarea
              placeholder="# Introduction&#10;Write details about procedures, policies, or decision log references here..."
              value={bodyMd}
              onChange={(e) => { setBodyMd(e.target.value); setDirty(true) }}
              className="field h-96 resize-y p-4 font-mono"
              required
            />
            <p className="text-body-sm leading-5 text-slate-500">Use standard Markdown links or wiki links such as <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-300">[[Incident Response Playbook]]</code>. Matching document titles become clickable links when published.</p>
          </div>

          {/* Tags */}
          <Input
            label="Tags"
            type="text"
            placeholder="incident, database, runbook (comma separated)"
            value={tagsInput}
            onChange={(e) => { setTagsInput(e.target.value); setDirty(true) }}
            hint="Tags become topics in the library. Add the primary topic first, then any secondary topics."
            className="py-2.5"
          />
        </div>

        {/* Sidebar attributes */}
        <div className="lg:col-span-1 space-y-5">
          {/* Properties card */}
          <div className="glass-panel rounded-2xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
              Parameters
            </h3>

            <div className="space-y-4">
              <div>
                <DepartmentPicker value={departmentIds} options={articleDepartments} onChange={ids => { setDepartmentIds(ids); setDept(articleDepartments.find(item => item.id === ids[0])?.name || ''); setDirty(true) }} />
                <p className="mt-1.5 text-body-sm leading-5 text-slate-500">Select all departments that should access this article. The first selected department is the primary department.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('editor.visibility')}</label>
                <Select
                  value={visibility}
                  onChange={(e) => { setVisibility(e.target.value as typeof visibility); setDirty(true) }}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-2.5 text-xs text-foreground outline-none focus:border-brand-500"
                >
                  <option value="department">{t('editor.visibilityDepartments')}</option>
                  <option value="public">{t('editor.visibilityPublic')}</option>
                  {/* Only rendered when the article already holds it, so the select can
                      show the true current value. Picking it is not offered anywhere. */}
                  {visibility === 'users' && <option value="users">{t('editor.visibilityUsers')}</option>}
                </Select>
                {visibility === 'users' && <p className="mt-1.5 text-body-sm leading-5 text-amber-300/90">{t('editor.visibilityUsersLocked')}</p>}
                <p className="mt-1.5 text-body-sm leading-5 text-slate-500">Explicit deny entries always override other access grants.</p>
              </div>

              {isEditMode && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Document type</label>
                  <Select
                    value={docType}
                    disabled={!canManageArticlePermissions}
                    onChange={(e) => { setDocType(e.target.value); setDirty(true) }}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-2.5 text-xs text-foreground outline-none focus:border-brand-500 disabled:opacity-60"
                  >
                    {ARTICLE_TYPES.map(value => <option key={value} value={value}>{value}</option>)}
                  </Select>
                  <label className="mt-3 block text-xs font-semibold text-slate-400 mb-1.5">Sensitivity</label>
                  <Select
                    value={sensitivity}
                    disabled={!canManageArticlePermissions}
                    onChange={(e) => { setSensitivity(e.target.value); setDirty(true) }}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-2.5 text-xs text-foreground outline-none focus:border-brand-500 disabled:opacity-60"
                  >
                    {SENSITIVITY_LEVELS.map(value => <option key={value} value={value}>{value}</option>)}
                  </Select>
                  {!canManageArticlePermissions && <p className="mt-1.5 text-body-sm leading-5 text-slate-500">Only permission managers can reclassify a document's type or sensitivity.</p>}
                  {canManageArticlePermissions && <p className="mt-1.5 text-body-sm leading-5 text-amber-300/90">Sensitivity controls who can see this article. A change is submitted for approval like any other edit.</p>}
                </div>
              )}

              {canManageArticlePermissions && (explicitUserIds.length > 0 || deniedUserIds.length > 0) && (
                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-300">Specific user access</p>
                    <p className="mt-1 text-body-sm leading-5 text-slate-500">Choose allowed users, then optionally deny selected users. A user cannot be in both lists.</p>
                  </div>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {visibleUsers.length ? visibleUsers.map(employee => {
                      const allowed = explicitUserIds.includes(employee.id)
                      const denied = deniedUserIds.includes(employee.id)
                      return <div key={employee.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-900">
                        <span className="min-w-0 flex-1 truncate text-slate-200">{employee.name} <span className="text-slate-500">({employee.email})</span></span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setExplicitUserIds(current => allowed ? current.filter(item => item !== employee.id) : [...current, employee.id]); setDeniedUserIds(current => current.filter(item => item !== employee.id)); setDirty(true) }} className={`rounded-md border px-2 py-1 text-caption font-semibold ${allowed ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 text-slate-500'}`}>Allow</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setDeniedUserIds(current => denied ? current.filter(item => item !== employee.id) : [...current, employee.id]); setExplicitUserIds(current => current.filter(item => item !== employee.id)); setDirty(true) }} className={`rounded-md border px-2 py-1 text-caption font-semibold ${denied ? 'border-rose-500/50 bg-rose-500/15 text-rose-300' : 'border-slate-700 text-slate-500'}`}>Deny</Button>
                      </div>
                    }) : <p className="py-2 text-body-sm text-slate-500">No company users are available.</p>}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('editor.language')}</label>
                <Select
                  value={language}
                  onChange={(e) => { setLanguage(e.target.value); setDirty(true) }}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-2.5 text-xs text-foreground outline-none focus:border-brand-500"
                >
                  <option value="en">English</option>
                  <option value="vi">Vietnamese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="zh">Chinese</option>
                </Select>
              </div>

              {isEditMode && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('editor.status')}</label>
                  <Select
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setDirty(true) }}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-2.5 text-xs text-foreground outline-none focus:border-brand-500"
                  >
                    <option value="draft">{t('editor.statusDraft')}</option>
                    <option value="published">{t('editor.statusPublished')}</option>
                    <option value="pending_review">{t('editor.statusPendingReview')}</option>
                  </Select>
                </div>
              )}

              <div>
                <Input
                  label="Next Review Date"
                  type="date"
                  value={nextReview}
                  onChange={(e) => { setNextReview(e.target.value); setDirty(true) }}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Save button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={saving}
            loading={saving}
            icon={<Save size={16} />}
            className="w-full shadow-lg shadow-brand-600/20 hover:shadow-brand-500/35"
          >
            {saving ? t('editor.saving') : t('editor.submit')}
          </Button>
        </div>

      </form>
    </div>
  )
}

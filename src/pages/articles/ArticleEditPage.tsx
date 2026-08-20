import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, Save, X } from 'lucide-react'
import { getArticle, createArticle, updateArticle } from '../../api/articles'
import { listDepartments, listUsers } from '../../api/auth'
import { useAuth } from '../../auth/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import { Select } from '../../components/ui/Select'
import { FloatingPanel } from '../../components/ui/FloatingPanel'

const ARTICLE_TEMPLATE = '# Purpose\n\n## Summary\n\n## Procedure or details\n\n## Ownership and review\n'
type Department = { id: string; name: string; company_domain: string; active: boolean }
type ManagedUser = { id: string; name: string; email: string; company_domain: string; active: boolean; dept?: string | null }

function DepartmentPicker({ value, options, onChange }: { value: string[]; options: Department[]; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const selected = value.map(id => options.find(item => item.id === id)).filter(Boolean) as Department[]
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id])

  return <div className="relative">
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label className="block text-xs font-semibold text-slate-400">Departments</label>
      <span className="text-[10px] font-semibold text-slate-500">{selected.length} selected</span>
    </div>
    <button ref={anchorRef} type="button" aria-expanded={open} onClick={() => setOpen(current => !current)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 text-left text-xs text-primary-foreground outline-none transition hover:border-brand-500/70 focus:border-brand-500">
      <span className={selected.length ? 'font-semibold text-primary-foreground' : 'text-slate-500'}>{selected.length ? `${selected.length} department${selected.length === 1 ? '' : 's'} selected` : 'Choose departments'}</span>
      <ChevronDown size={15} className={`shrink-0 text-slate-500 transition ${open ? 'rotate-180 text-brand-400' : ''}`} />
    </button>
    <FloatingPanel anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} className="border-slate-700 bg-slate-900 p-1.5 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-2.5 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Article visibility</span>
        {selected.length > 0 && <button type="button" onClick={() => onChange([])} className="text-[10px] font-semibold text-brand-400 hover:text-brand-300">Clear all</button>}
      </div>
      <div className="py-1">
        {options.length ? options.map(item => { const checked = value.includes(item.id); return <button key={item.id} type="button" onClick={() => toggle(item.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-xs text-slate-200 transition hover:bg-slate-800">
          <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? 'border-brand-500 bg-brand-500 text-primary-foreground' : 'border-slate-600 bg-slate-950'}`}>{checked && <Check size={11} strokeWidth={3} />}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{item.name}</span>
          {checked && value[0] === item.id && <span className="text-[10px] font-semibold text-brand-400">Primary</span>}
        </button> }) : <p className="px-2.5 py-3 text-xs text-slate-500">No departments available.</p>}
      </div>
    </FloatingPanel>
    {selected.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{selected.map((item, index) => <span key={item.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${index === 0 ? 'border-brand-500/30 bg-brand-500/10 text-brand-300' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>
      {item.name}{index === 0 && <span className="text-[9px] uppercase tracking-wide opacity-70">primary</span>}
      <button type="button" aria-label={`Remove ${item.name}`} onClick={() => toggle(item.id)} className="rounded-full p-0.5 hover:bg-white/10"><X size={11} /></button>
    </span>)}</div>}
  </div>
}

export default function ArticleEditPage() {
  const { id } = useParams<{ id: string }>()
  const isEditMode = !!id
  const navigate = useNavigate()
  const dialog = useDialog()

  // Form states
  const [title, setTitle] = useState('')
  const [bodyMd, setBodyMd] = useState('')
  const [dept, setDept] = useState('')
  const [departmentIds, setDepartmentIds] = useState<string[]>([])
  const [language, setLanguage] = useState('vi')
  const [status, setStatus] = useState('draft')
  const [tagsInput, setTagsInput] = useState('')
  const [nextReview, setNextReview] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'department' | 'users'>('department')
  const [explicitUserIds, setExplicitUserIds] = useState<string[]>([])
  const [deniedUserIds, setDeniedUserIds] = useState<string[]>([])

  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const canManageArticlePermissions = Boolean(user?.permissions?.includes('permission.manage'))
  const visibleDepartments = departments.filter(item => item.active && item.company_domain === user?.company_domain)
  const visibleUsers = users.filter(item => item.active && item.company_domain === user?.company_domain)

  useEffect(() => {
    const fetchSetupData = async () => {
      setLoading(true)
      try {
        const [departmentData, userData] = await Promise.all([
          listDepartments() as Promise<Department[]>,
          canManageArticlePermissions ? listUsers() as Promise<ManagedUser[]> : Promise.resolve([]),
        ])
        setDepartments(departmentData)
        setUsers(userData)

        if (isEditMode && id) {
          const art = await getArticle(id)
          setTitle(art.title)
          setBodyMd(art.body_md)
          setDept(art.dept)
          const articleDepartmentIds = art.departments?.length ? art.departments.map((item: { id: string; name?: string }) => item.id) : departmentData.filter(item => item.name === art.dept).map(item => item.id)
          const primaryDepartmentId = art.departments?.find((item: { id: string; name?: string }) => item.name === art.dept)?.id || articleDepartmentIds[0]
          setDepartmentIds(primaryDepartmentId ? [primaryDepartmentId, ...articleDepartmentIds.filter((item: string) => item !== primaryDepartmentId)] : [])
          setLanguage(art.language || 'vi')
          setStatus(art.status)
          setVisibility(art.visibility || 'department')
          setExplicitUserIds((art.explicit_user_ids || []).map((item: string) => String(item)))
          setDeniedUserIds((art.explicit_denied_user_ids || []).map((item: string) => String(item)))
          setTagsInput(art.tags ? art.tags.map((t: any) => t.tag).join(', ') : '')
          if (art.next_review) {
            setNextReview(new Date(art.next_review).toISOString().split('T')[0])
          }
        } else {
          const defaultDepartment = departmentData.find(item => item.active && item.company_domain === user?.company_domain && item.name === user?.dept)
            || departmentData.find(item => item.active && item.company_domain === user?.company_domain)
          if (defaultDepartment) { setDept(defaultDepartment.name); setDepartmentIds([defaultDepartment.id]) }
        }
      } catch (err) {
        console.error(err)
        setError('Failed to load article metadata or details')
      } finally {
        setLoading(false)
      }
    }
    fetchSetupData()
  }, [id, isEditMode, user?.dept, user?.company_domain, canManageArticlePermissions])

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
    if (!isEditMode || canManageArticlePermissions) {
      payload.visibility = visibility
      payload.explicit_user_ids = explicitUserIds
      payload.denied_user_ids = deniedUserIds
    }

    try {
      if (isEditMode && id) {
        await updateArticle(id, payload)
        navigate('/governance/pending-drafts')
      } else {
        await createArticle(payload)
        navigate('/governance/pending-drafts')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.detail || 'Failed to save article')
    } finally {
      setSaving(false)
    }
  }

  const insertTemplate = async () => {
    if (bodyMd.trim() && !(await dialog.confirm('Replace the current body with the basic article template?', { title: 'Replace article body', confirmLabel: 'Replace', tone: 'info' }))) return
    setBodyMd(ARTICLE_TEMPLATE)
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
        <button
          onClick={() => navigate(-1)}
          className="mm-secondary flex items-center gap-1.5 px-3 py-2 text-sm"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
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
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-300">Document Title</label>
            <input
              type="text"
              placeholder="e.g., Incident Response Playbook: Database Outages"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field py-3"
              required
            />
          </div>

          {/* Markdown Content */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-300">Body Markdown</label>
              <button type="button" onClick={insertTemplate} className="text-xs font-semibold text-brand-400 hover:text-brand-300">
                Insert basic template
              </button>
            </div>
            <textarea
              placeholder="# Introduction&#10;Write details about procedures, policies, or decision log references here..."
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              className="field h-96 resize-y p-4 font-mono"
              required
            />
            <p className="text-[11px] leading-5 text-slate-500">Use standard Markdown links or wiki links such as <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-300">[[Incident Response Playbook]]</code>. Matching document titles become clickable links when published.</p>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-300">Tags</label>
            <input
              type="text"
              placeholder="incident, database, runbook (comma separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="field py-2.5"
            />
            <p className="text-[11px] leading-5 text-slate-500">Tags become topics in the library. Add the primary topic first, then any secondary topics.</p>
          </div>
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
                <DepartmentPicker value={departmentIds} options={articleDepartments} onChange={ids => { setDepartmentIds(ids); setDept(articleDepartments.find(item => item.id === ids[0])?.name || '') }} />
                <p className="mt-1.5 text-[11px] leading-5 text-slate-500">Select all departments that should access this article. The first selected department is the primary department.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Article visibility</label>
                <Select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-2.5 text-xs text-primary-foreground outline-none focus:border-brand-500"
                >
                  <option value="department">Selected departments</option>
                  <option value="public">Company-wide</option>
                  <option value="users">Specific users</option>
                </Select>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-500">Explicit deny entries always override other access grants.</p>
              </div>

              {canManageArticlePermissions && (visibility === 'users' || explicitUserIds.length > 0 || deniedUserIds.length > 0) && (
                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-300">Specific user access</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">Choose allowed users, then optionally deny selected users. A user cannot be in both lists.</p>
                  </div>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {visibleUsers.length ? visibleUsers.map(employee => {
                      const allowed = explicitUserIds.includes(employee.id)
                      const denied = deniedUserIds.includes(employee.id)
                      return <div key={employee.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-900">
                        <span className="min-w-0 flex-1 truncate text-slate-200">{employee.name} <span className="text-slate-500">({employee.email})</span></span>
                        <button type="button" onClick={() => { setExplicitUserIds(current => allowed ? current.filter(item => item !== employee.id) : [...current, employee.id]); setDeniedUserIds(current => current.filter(item => item !== employee.id)) }} className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${allowed ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 text-slate-500'}`}>Allow</button>
                        <button type="button" onClick={() => { setDeniedUserIds(current => denied ? current.filter(item => item !== employee.id) : [...current, employee.id]); setExplicitUserIds(current => current.filter(item => item !== employee.id)) }} className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${denied ? 'border-rose-500/50 bg-rose-500/15 text-rose-300' : 'border-slate-700 text-slate-500'}`}>Deny</button>
                      </div>
                    }) : <p className="py-2 text-[11px] text-slate-500">No company users are available.</p>}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Language</label>
                <Select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-2.5 text-xs text-primary-foreground outline-none focus:border-brand-500"
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
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Status</label>
                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-2.5 text-xs text-primary-foreground outline-none focus:border-brand-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="pending_review">Pending Review</option>
                  </Select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Next Review Date</label>
                <input
                  type="date"
                  value={nextReview}
                  onChange={(e) => setNextReview(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-2.5 text-xs text-primary-foreground outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Save button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-brand-600 hover:bg-brand-500 text-primary-foreground font-semibold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20 hover:shadow-brand-500/35 transition-all disabled:opacity-50"
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Submit for approval'}</span>
          </button>
        </div>

      </form>
    </div>
  )
}

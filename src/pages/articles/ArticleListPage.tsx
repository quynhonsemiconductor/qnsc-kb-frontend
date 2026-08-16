import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Plus, Filter, Tag as TagIcon, Layers, Shield, MessageSquare, ThumbsUp, Bookmark, Upload, Sparkles, CheckSquare, Square, X } from 'lucide-react'
import { autoTagArticles, confirmArticleTags, getArticles } from '../../api/articles'
import { getTags } from '../../api/search'
import { uploadSources } from '../../api/governance'
import { useDialog } from '../../components/ui/DialogProvider'
import { useLanguage } from '../../i18n/LanguageProvider'
import { useAuth } from '../../auth/useAuth'
import { listDepartments } from '../../api/auth'
import { Select } from '../../components/ui/Select'

type Department = { id: string; name: string; company_domain: string; active: boolean }

function UploadDepartmentPicker({ value, options, onChange }: { value: string[]; options: Department[]; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const selected = value.map(id => options.find(item => item.id === id)).filter(Boolean) as Department[]
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id])

  return <div className="relative"><div className="mb-1 flex items-center justify-between gap-2"><span className="text-xs font-semibold text-steel">Target departments</span><span className="text-[10px] font-semibold text-stone">{selected.length} selected</span></div><button type="button" aria-expanded={open} onClick={() => setOpen(current => !current)} className="field flex min-h-11 w-full items-center justify-between gap-3 text-left text-xs transition hover:border-cyan/60"><span className={selected.length ? 'font-semibold text-ink' : 'text-stone'}>{selected.length ? `${selected.length} department${selected.length === 1 ? '' : 's'} selected` : 'Choose departments'}</span><ChevronDown size={15} className={`shrink-0 text-stone transition ${open ? 'rotate-180 text-cyan' : ''}`} /></button>{open && <div className="absolute inset-x-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-xl border border-hairline bg-card p-1.5 shadow-[0_18px_40px_rgb(var(--shadow)/.2)]"><div className="flex items-center justify-between border-b border-hairline px-2.5 py-2"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-stone">Article access</span>{selected.length > 0 && <button type="button" onClick={() => onChange([])} className="text-[10px] font-semibold text-cyan hover:underline">Clear all</button>}</div><div className="max-h-48 overflow-y-auto py-1">{options.length ? options.map(item => { const checked = value.includes(item.id); return <button key={item.id} type="button" onClick={() => toggle(item.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-xs text-ink transition hover:bg-surface-soft"><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? 'border-cyan bg-cyan text-[#07131a]' : 'border-steel bg-input'}`}>{checked && <Check size={11} strokeWidth={3} />}</span><span className="min-w-0 flex-1 truncate font-semibold">{item.name}</span>{checked && value[0] === item.id && <span className="text-[10px] font-semibold text-cyan">Primary</span>}</button> }) : <p className="px-2.5 py-3 text-xs text-stone">No departments available.</p>}</div></div>}{selected.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{selected.map((item, index) => <span key={item.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${index === 0 ? 'border-cyan/30 bg-cyan/10 text-cyan' : 'border-hairline bg-surface text-steel'}`}>{item.name}{index === 0 && <span className="text-[9px] uppercase tracking-wide opacity-70">primary</span>}<button type="button" aria-label={`Remove ${item.name}`} onClick={() => toggle(item.id)} className="rounded-full p-0.5 hover:bg-black/5"><X size={11} /></button></span>)}</div>}</div>
}

export default function ArticleListPage() {
  const [articles, setArticles] = useState<any[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([])
  const [autoTagging, setAutoTagging] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadTags, setUploadTags] = useState<string[]>([])
  const [uploadDepartmentIds, setUploadDepartmentIds] = useState<string[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const navigate = useNavigate()
  const dialog = useDialog()
  const { t } = useLanguage()
  const { user } = useAuth()

  const toggleArticleSelection = (articleId: string) => {
    setSelectedArticleIds(current => current.includes(articleId) ? current.filter(id => id !== articleId) : [...current, articleId])
  }

  const handleAutoTag = async () => {
    if (!selectedArticleIds.length || autoTagging) return
    setAutoTagging(true)
    try {
      const result = await autoTagArticles(selectedArticleIds)
      const suggestions = result.results?.filter((item: any) => item.suggested_tags?.length > 0) || []
      if (!suggestions.length) {
        await dialog.alert('AI did not suggest any new tags for the selected articles.', { title: 'No tag suggestions', tone: 'info' })
        return
      }
      const approved = await dialog.confirm(
        `Review the suggested tags before confirming:\n\n${suggestions.map((item: any) => `${item.title}: ${item.suggested_tags.join(', ')}`).join('\n')}\n\nConfirm these suggestions?`,
        { title: 'Confirm AI tag suggestions', confirmLabel: 'Apply tags' },
      )
      if (approved) {
        await confirmArticleTags(suggestions.map((item: any) => ({ article_id: item.article_id, tags: item.proposed_tags })))
        await dialog.alert('The confirmed tag sets were saved.', { title: 'Tags confirmed', tone: 'success' })
        await fetchArticlesList()
      }
      setSelectedArticleIds([])
    } catch (error: any) {
      await dialog.alert(error?.response?.data?.detail || 'Could not generate tags for the selected articles.', { title: 'AI tagging failed', tone: 'danger' })
    } finally {
      setAutoTagging(false)
    }
  }
  const articleStats = useMemo(() => ({
    total: articles.length,
    published: articles.filter(article => article.status === 'published').length,
    drafts: articles.filter(article => article.status !== 'published').length,
  }), [articles])

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    setUploadFiles(files)
    setUploadTags(files.map(() => ''))
    const defaultDepartmentId = departments.find(item => item.active && item.company_domain === user?.company_domain && item.name === user?.dept)?.id
    if (defaultDepartmentId) setUploadDepartmentIds(current => current.length ? current : [defaultDepartmentId])
  }

  const handleSourceUpload = async () => {
    if (!uploadFiles.length) return
    const tagsByFile = uploadTags.map(value => value.split(',').map(tag => tag.trim()).filter(Boolean))
    setUploading(true)
    try {
      const primaryDepartment = departments.find(item => item.id === uploadDepartmentIds[0])?.name || user?.dept || undefined
      const result = await uploadSources(uploadFiles, tagsByFile, primaryDepartment, uploadDepartmentIds)
      // The batch endpoint returns { results: [...] }. Keep compatibility
      // with the single-file endpoint/proxies that return the draft directly.
      const resultPayload: any = result
      const items = Array.isArray(resultPayload?.results)
        ? resultPayload.results
        : resultPayload?.id
          ? [{ ...resultPayload, status: resultPayload.status === 'pending' ? 'queued' : (resultPayload.status || 'queued') }]
          : []
      const queued = items.filter((item: any) => ['queued', 'pending'].includes(item.status) || (!item.status && item.id))
      const duplicates = items.filter((item: any) => ['duplicate', 'duplicate_document'].includes(item.status) || item.detail?.code === 'duplicate_document')
      const failed = items.filter((item: any) => !queued.includes(item) && !duplicates.includes(item))
      const processed = items.length || Number(result?.queued_count || 0) + Number(result?.duplicate_count || 0) + Number(result?.failed_count || 0)
      const failureDetails = failed
        .map((item: any) => {
          const message = item.detail?.message || item.detail || 'Upload failed without a detailed error.'
          return `• ${item.filename || 'File'}: ${typeof message === 'string' ? message : 'Upload failed without a detailed error.'}`
        })
        .join('\n')
      const summary = processed === 0
        ? 'No files were processed. Please select files again and retry.'
        : `${processed} file${processed === 1 ? '' : 's'} processed\n\n${queued.length} queued for review\n${duplicates.length} duplicate${duplicates.length === 1 ? '' : 's'} skipped\n${failed.length} failed${failureDetails ? `\n\nDetails:\n${failureDetails}` : ''}`
      const resultTone = queued.length > 0 ? 'success' : failed.length > 0 ? 'danger' : 'info'
      const resultTitle = queued.length > 0 ? 'Upload successful' : failed.length > 0 ? 'Upload needs attention' : 'No new files uploaded'
      const openQueue = queued.length > 0
        ? await dialog.confirm('Your files were uploaded and queued for review. AI reading views will continue formatting in the background; follow their status in Pending Drafts.', { title: 'Upload successful', confirmLabel: 'Review now', cancelLabel: 'Close', tone: 'success' })
        : (await dialog.alert(summary, { title: resultTitle, tone: resultTone }), false)
      if (openQueue) navigate('/governance/pending-drafts')
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      if (error?.response?.status === 409 && detail?.code === 'duplicate_document') {
        const existing = detail.article_id ? ` Existing article: ${detail.article_id}.` : ''
        await dialog.alert(`This document already exists and was not uploaded.${existing}`, { title: 'Duplicate document', confirmLabel: 'Understood', tone: 'info' })
      } else if (typeof detail === 'object' && detail?.code === 'update_confirmation_required') {
        await dialog.alert('A very similar document is already in the knowledge base. Review the pending draft and choose whether it is an update or a new document.', { title: 'Similar document found', tone: 'info' })
        navigate('/governance/pending-drafts')
      } else {
        await dialog.alert(detail || 'Could not process this source file.', { title: 'Upload failed' })
      }
    } finally {
      setUploading(false)
      setUploadFiles([])
      setUploadTags([])
      setUploadDepartmentIds([])
    }
  }

  const fetchArticlesList = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (selectedDept) params.dept = selectedDept
      if (selectedStatus) params.status = selectedStatus
      if (searchQuery) params.q = searchQuery
      
      const data = await getArticles(params)
      setArticles(data)
    } catch (err) {
      console.error('Failed to fetch articles', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArticlesList()
  }, [selectedDept, selectedStatus, searchQuery])

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [tagData, departmentData] = await Promise.all([getTags(), listDepartments()])
        setTags(tagData)
        setDepartments(departmentData)
      } catch (err) {
        console.error(err)
      }
    }
    fetchMetadata()
  }, [])

  return (
    <div className="page-shell-wide page-stack pb-8">
      {/* Upper action bar */}
      <div className="page-hero glass-panel soft-grid signal-line relative overflow-hidden rounded-panel border border-border px-4 py-5 sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-12 -top-20 hidden h-56 w-56 opacity-70 xl:block"><div className="hero-orb h-full w-full"><div className="orbit-ring" /><div className="orb-core text-xl">Q</div></div></div>
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone"><Layers size={14} className="text-cyan" /> {t('articles.workspace')}</div>
          <h1 className="font-display text-2xl font-extrabold tracking-[-.05em] text-foreground sm:text-3xl">{t('articles.title')}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t('articles.subtitle')}</p>
        </div>
        <div className="relative flex flex-wrap gap-2 self-start sm:self-auto">
          {selectedArticleIds.length > 0 && <button type="button" onClick={() => void handleAutoTag()} disabled={autoTagging} className="inline-flex items-center gap-2 rounded-xl border border-info/30 bg-info/10 px-4 py-2.5 text-sm font-semibold text-info transition hover:bg-info/20 disabled:opacity-50"><Sparkles size={16} />{autoTagging ? 'Generating tags…' : `AI auto-tag (${selectedArticleIds.length})`}</button>}
          <input ref={uploadInputRef} type="file" multiple className="hidden" onChange={handleFileSelection} accept=".pdf,.docx,.xlsx,.xlsm,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp" />
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-surface-soft disabled:opacity-50"
          >
            <Upload size={16} />
            <span>{uploading ? t('articles.processing') : t('articles.uploadSources')}</span>
          </button>
          <Link
            to="/articles/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_rgb(var(--primary)/.22)] transition-all hover:-translate-y-0.5 hover:bg-primary/90"
          >
            <Plus size={18} />
            <span>{t('articles.newArticle')}</span>
          </Link>
        </div>
        </div>
      </div>

      {uploadFiles.length > 0 && (
        <div className="glass-panel rounded-2xl border border-info/25 p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink">Add tags to uploaded files</h2>
              <p className="mt-0.5 text-xs text-steel">Use comma-separated tags. These tags will be saved with each pending draft and published article.</p>
            </div>
            <button type="button" onClick={() => { setUploadFiles([]); setUploadTags([]); setUploadDepartmentIds([]) }} className="text-xs font-semibold text-stone hover:text-ink">Cancel</button>
          </div>
          <div className="mb-3"><UploadDepartmentPicker value={uploadDepartmentIds} options={departments.filter(item => item.active && item.company_domain === user?.company_domain)} onChange={setUploadDepartmentIds} /><p className="mt-1.5 text-[11px] leading-5 text-stone">Choose every department that should receive access to the uploaded article. The first one is the primary department.</p></div>
          <div className="space-y-2">
            {uploadFiles.map((file, index) => (
              <div key={`${file.name}-${file.lastModified}`} className="grid gap-2 rounded-lg border border-hairline bg-surface p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center">
                <div className="min-w-0"><p className="truncate text-xs font-semibold text-ink">{file.name}</p><p className="text-[11px] text-stone">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div>
                <input value={uploadTags[index] || ''} onChange={event => setUploadTags(current => current.map((value, tagIndex) => tagIndex === index ? event.target.value : value))} placeholder="e.g. database, incident response, sop" className="field text-xs" aria-label={`Tags for ${file.name}`} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => void handleSourceUpload()} disabled={uploading} className="inline-flex items-center gap-2 rounded-lg bg-cyan px-4 py-2 text-xs font-semibold text-[#07131a] transition hover:bg-cyan/80 disabled:opacity-50"><Upload size={14} />{uploading ? 'Uploading…' : `Upload ${uploadFiles.length} file${uploadFiles.length === 1 ? '' : 's'}`}</button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[[t('articles.visible'), articleStats.total, 'text-info'], [t('articles.published'), articleStats.published, 'text-success'], [t('articles.inProgress'), articleStats.drafts, 'text-warning']].map(([label, value, tone]) => <div key={String(label)} className="metric-spark interactive-lift rounded-2xl border border-border p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[.13em] text-muted-foreground">{label}</p><span className={`h-2 w-2 rounded-full bg-current shadow-[0_0_12px_currentColor] ${tone}`} /></div><p className={`mt-2 font-display text-3xl font-extrabold tracking-tight ${tone}`}>{value}</p><div className="mt-3 h-1.5 rounded-full bg-surface-muted"><div className={`h-full w-1/2 rounded-full bg-current opacity-70 ${tone}`} /></div></div>)}
      </div>

      {/* Filter panel */}
      <div className="rounded-2xl border border-border bg-surface/70 p-5 shadow-[0_12px_30px_rgb(var(--shadow)/.08)] backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2 border-b border-border pb-4">
          <Filter size={16} className="text-slate-400" />
          <div><span className="text-sm font-semibold text-slate-300">{t('articles.find')}</span><p className="mt-0.5 text-[11px] text-slate-500">{t('articles.findHelp')}</p></div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Search Input */}
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('articles.searchText')}</label>
            <input
              type="text"
              placeholder={t('articles.searchTitle')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-xs text-primary-foreground placeholder-slate-500 outline-none focus:border-brand-500"
            />
          </div>

          {/* Department Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('articles.department')}</label>
            <Select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-xs text-primary-foreground outline-none focus:border-brand-500"
            >
              <option value="">{t('articles.allDepartments')}</option>
              {departments.filter(item => item.active && item.company_domain === user?.company_domain).map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
            </Select>
          </div>

          {/* Status Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('articles.status')}</label>
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-xs text-primary-foreground outline-none focus:border-brand-500"
            >
              <option value="">{t('articles.allStatuses')}</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="pending_review">Pending Review</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex justify-center items-center h-64 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500 mr-3" />
          <span>{t('common.loading')}</span>
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/10 p-12 text-center">
          <Layers className="mx-auto text-slate-600 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-primary-foreground">{t('articles.noArticles')}</h3>
          <p className="text-slate-500 text-sm mt-1">Try resetting your filters or make a new write-up.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((art) => (
            <div
              key={art.id}
              onClick={() => navigate(`/articles/${art.id}`)}
              className="interactive-lift group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-[0_10px_26px_rgb(var(--shadow)/.08)]"
            >
              <button
                type="button"
                aria-label={`Select ${art.title}`}
                onClick={(event) => { event.stopPropagation(); toggleArticleSelection(art.id) }}
                className="absolute right-4 top-4 rounded-md p-1 text-slate-500 transition hover:bg-surface-soft hover:text-cyan"
              >
                {selectedArticleIds.includes(art.id) ? <CheckSquare size={18} className="text-cyan" /> : <Square size={18} />}
              </button>
              <div>
                {/* Badges row */}
                <div className="flex flex-wrap gap-2 mb-3.5">
                    <span className="rounded-full border border-info/20 bg-info/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-info">
                    {art.dept}
                  </span>
                  {art.status === 'draft' && (
                      <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                      Draft
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="line-clamp-2 text-lg font-bold text-foreground transition-colors group-hover:text-info">
                  {art.title}
                </h3>
                
                {/* Description snippet */}
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {art.body_md ? art.body_md.replace(/[#*`_]/g, '') : 'No content preview.'}
                </p>
              </div>

              {/* Footer info card */}
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold uppercase text-primary">
                    {art.owner?.name?.substring(0, 2) || 'OW'}
                  </div>
                  <span>{art.owner?.name || 'Owner'}</span>
                </div>
                <span>v{art.version}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

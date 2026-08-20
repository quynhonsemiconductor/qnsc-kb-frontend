import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, FileText, FolderTree, Plus, Search, Sparkles, Square, CheckSquare, Upload, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { autoTagArticles, confirmArticleTags, getArticles } from '../../api/articles'
import { getTags } from '../../api/search'
import { uploadSource, uploadSources } from '../../api/governance'
import { useDialog } from '../../components/ui/DialogProvider'
import { useAuth } from '../../auth/useAuth'
import { listDepartments } from '../../api/auth'
import { Select } from '../../components/ui/Select'
import { FloatingPanel } from '../../components/ui/FloatingPanel'
import PageHeader from '../../components/ui/PageHeader'

type Department = { id: string; name: string; company_domain: string; active: boolean }
type UploadResult = { filename: string; status: string; status_code?: number; detail?: { message?: string; code?: string }; id?: string; [key: string]: any }
const PAGE_SIZE = 24

function UploadDepartmentPicker({ value, options, onChange }: { value: string[]; options: Department[]; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const selected = value.map(id => options.find(item => item.id === id)).filter(Boolean) as Department[]
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id])

  return <div className="relative"><div className="mb-1 flex items-center justify-between gap-2"><span className="text-xs font-semibold text-steel">Target departments</span><span className="text-[10px] font-semibold text-stone">{selected.length} selected</span></div><button ref={anchorRef} type="button" aria-expanded={open} onClick={() => setOpen(current => !current)} className="field flex min-h-11 w-full items-center justify-between gap-3 text-left text-xs transition hover:border-cyan/60"><span className={selected.length ? 'font-semibold text-ink' : 'text-stone'}>{selected.length ? `${selected.length} department${selected.length === 1 ? '' : 's'} selected` : 'Choose departments'}</span><ChevronDown size={15} className={`shrink-0 text-stone transition ${open ? 'rotate-180 text-cyan' : ''}`} /></button><FloatingPanel anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} className="p-1.5"><div className="flex items-center justify-between border-b border-hairline px-2.5 py-2"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-stone">Article access</span>{selected.length > 0 && <button type="button" onClick={() => onChange([])} className="text-[10px] font-semibold text-cyan hover:underline">Clear all</button>}</div><div className="py-1">{options.length ? options.map(item => { const checked = value.includes(item.id); return <button key={item.id} type="button" onClick={() => toggle(item.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-xs text-ink transition hover:bg-surface-soft"><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? 'border-cyan bg-cyan text-[#07131a]' : 'border-steel bg-input'}`}>{checked && <Check size={11} strokeWidth={3} />}</span><span className="min-w-0 flex-1 truncate font-semibold">{item.name}</span>{checked && value[0] === item.id && <span className="text-[10px] font-semibold text-cyan">Primary</span>}</button> }) : <p className="px-2.5 py-3 text-xs text-stone">No departments available.</p>}</div></FloatingPanel>{selected.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{selected.map((item, index) => <span key={item.id} className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-1 text-[10px] font-semibold text-steel">{item.name}{index === 0 && <span className="text-[9px] uppercase tracking-wide opacity-70">primary</span>}<button type="button" aria-label={`Remove ${item.name}`} onClick={() => toggle(item.id)} className="rounded-full p-0.5 hover:bg-black/5"><X size={11} /></button></span>)}</div>}</div>
}

export default function ArticleListPage() {
  const [articles, setArticles] = useState<any[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([])
  const [autoTagging, setAutoTagging] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadTags, setUploadTags] = useState<string[]>([])
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])
  const [uploadDepartmentIds, setUploadDepartmentIds] = useState<string[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const dialog = useDialog()
  const { user } = useAuth()

  const fetchArticlesList = async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { limit: PAGE_SIZE, offset }
      if (selectedDept) params.dept = selectedDept
      if (selectedTopic) params.topic = selectedTopic
      if (selectedStatus) params.status = selectedStatus
      if (searchQuery.trim()) params.q = searchQuery.trim()
      setArticles(await getArticles(params))
    } catch (err) {
      console.error('Failed to fetch articles', err)
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchArticlesList() }, [selectedDept, selectedTopic, selectedStatus, searchQuery, offset])

  useEffect(() => {
    void Promise.all([getTags(), listDepartments()]).then(([tagData, departmentData]) => { setTags(tagData); setDepartments(departmentData) }).catch(console.error)
  }, [])

  const toggleArticleSelection = (articleId: string) => setSelectedArticleIds(current => current.includes(articleId) ? current.filter(id => id !== articleId) : [...current, articleId])
  const selectAllOnPage = () => setSelectedArticleIds(current => current.length === articles.length ? [] : articles.map(article => article.id))

  const handleAutoTag = async () => {
    if (!selectedArticleIds.length || autoTagging) return
    setAutoTagging(true)
    try {
      const result = await autoTagArticles(selectedArticleIds)
      const suggestions = result.results?.filter((item: any) => item.suggested_tags?.length > 0) || []
      if (!suggestions.length) await dialog.alert('AI did not suggest any new tags for the selected documents.', { title: 'No tag suggestions', tone: 'info' })
      else if (await dialog.confirm(`Review the suggested tags before confirming:\n\n${suggestions.map((item: any) => `${item.title}: ${item.suggested_tags.join(', ')}`).join('\n')}\n\nConfirm these suggestions?`, { title: 'Confirm AI tag suggestions', confirmLabel: 'Apply tags' })) {
        await confirmArticleTags(suggestions.map((item: any) => ({ article_id: item.article_id, tags: item.proposed_tags })))
        await dialog.alert('The confirmed tag sets were saved.', { title: 'Tags confirmed', tone: 'success' })
        await fetchArticlesList()
      }
      setSelectedArticleIds([])
    } catch (error: any) {
      await dialog.alert(error?.response?.data?.detail || 'Could not generate tags for the selected documents.', { title: 'AI tagging failed', tone: 'danger' })
    } finally { setAutoTagging(false) }
  }

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    setUploadFiles(files)
    setUploadTags(files.map(() => ''))
    setUploadResults([])
    const defaultDepartmentId = departments.find(item => item.active && item.company_domain === user?.company_domain && item.name === user?.dept)?.id
    if (defaultDepartmentId) setUploadDepartmentIds(current => current.length ? current : [defaultDepartmentId])
  }

  const handleSourceUpload = async () => {
    if (!uploadFiles.length) return
    setUploading(true)
    try {
      const tagsByFile = uploadTags.map(value => value.split(',').map(tag => tag.trim()).filter(Boolean))
      const primaryDepartment = departments.find(item => item.id === uploadDepartmentIds[0])?.name || user?.dept || undefined
      const result: any = await uploadSources(uploadFiles, tagsByFile, primaryDepartment, uploadDepartmentIds)
      const items: UploadResult[] = Array.isArray(result?.results) ? result.results : result?.id ? [{ ...result, status: result.status === 'pending' ? 'queued' : (result.status || 'queued') }] : []
      setUploadResults(items)
      const queued = items.filter((item: any) => ['queued', 'pending'].includes(item.status) || (!item.status && item.id))
      const duplicates = items.filter((item: any) => ['duplicate', 'duplicate_document'].includes(item.status) || item.detail?.code === 'duplicate_document')
      const failed = items.filter((item: any) => !queued.includes(item) && !duplicates.includes(item))
      const processed = items.length || Number(result?.queued_count || 0) + Number(result?.duplicate_count || 0) + Number(result?.failed_count || 0)
      const summary = processed === 0 ? 'No files were processed.' : `${processed} file${processed === 1 ? '' : 's'} processed\n\n${queued.length} queued for review\n${duplicates.length} duplicate${duplicates.length === 1 ? '' : 's'} skipped\n${failed.length} failed`
      if (queued.length > 0 && await dialog.confirm(summary, { title: failed.length ? 'Upload partially complete' : 'Upload successful', confirmLabel: 'Review now', cancelLabel: 'Keep results', tone: failed.length ? 'info' : 'success' })) {
        navigate('/governance/pending-drafts')
        setUploadFiles([]); setUploadTags([]); setUploadResults([]); setUploadDepartmentIds([])
      } else if (!queued.length && failed.length === 0) {
        await dialog.alert(summary, { title: 'Upload complete', tone: 'success' })
        setUploadFiles([]); setUploadTags([]); setUploadResults([]); setUploadDepartmentIds([])
      } else {
        await dialog.alert(`${summary}\n\nFailed files remain below. Fix the cause and retry them individually.`, { title: 'Upload needs attention', tone: 'danger' })
      }
    } catch (error: any) {
      await dialog.alert(error?.response?.data?.detail || 'Could not process this source file.', { title: 'Upload failed' })
    } finally { setUploading(false) }
  }

  const retryUpload = async (index: number) => {
    const file = uploadFiles[index]
    if (!file || uploading) return
    setUploading(true)
    setUploadResults(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: 'retrying', detail: undefined } : item))
    try {
      const primaryDepartment = departments.find(item => item.id === uploadDepartmentIds[0])?.name || user?.dept || undefined
      const result: any = await uploadSource(file, (uploadTags[index] || '').split(',').map(tag => tag.trim()).filter(Boolean), primaryDepartment, uploadDepartmentIds)
      setUploadResults(current => current.map((item, itemIndex) => itemIndex === index ? { filename: file.name, ...result, status: result.status === 'pending' ? 'queued' : (result.status || 'queued') } : item))
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      setUploadResults(current => current.map((item, itemIndex) => itemIndex === index ? { filename: file.name, status: detail?.code === 'duplicate_document' ? 'duplicate' : 'failed', status_code: error?.response?.status, detail: typeof detail === 'object' ? detail : { message: detail || error?.message || 'Upload failed' } } : item))
    } finally { setUploading(false) }
  }

  const updateFilter = (setter: (value: string) => void, value: string) => { setter(value); setOffset(0); setSelectedArticleIds([]) }
  const filtersActive = Boolean(searchQuery || selectedDept || selectedTopic || selectedStatus)
  const clearFilters = () => { setSearchQuery(''); setSelectedDept(''); setSelectedTopic(''); setSelectedStatus(''); setOffset(0); setSelectedArticleIds([]) }

  return <div className="page-shell-wide page-stack pb-8">
    <PageHeader eyebrow="Document management" title="Knowledge library" description="A calm workspace for finding, organizing, uploading, and updating documents." icon={FileText} actions={<><input ref={uploadInputRef} type="file" multiple className="hidden" onChange={handleFileSelection} accept=".pdf,.docx,.xlsx,.xlsm,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp" /><button type="button" onClick={() => uploadInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-soft disabled:opacity-50"><Upload size={15} /> {uploading ? 'Processing…' : 'Upload files'}</button><Link to="/articles/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus size={15} /> New document</Link></>} />

    {uploadFiles.length > 0 && <section className="rounded-xl border border-info/25 bg-info/5 p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-foreground">Prepare uploaded files</h2><p className="mt-1 text-xs text-muted-foreground">Add topics and choose who can access these documents. Each file keeps its own result so failed uploads can be retried.</p></div><button type="button" onClick={() => { setUploadFiles([]); setUploadTags([]); setUploadResults([]); setUploadDepartmentIds([]) }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button></div><UploadDepartmentPicker value={uploadDepartmentIds} options={departments.filter(item => item.active && item.company_domain === user?.company_domain)} onChange={setUploadDepartmentIds} /><div className="mt-3 space-y-2">{uploadFiles.map((file, index) => { const result = uploadResults[index]; const failed = result?.status === 'failed'; const complete = ['queued', 'duplicate'].includes(result?.status); return <div key={`${file.name}-${file.lastModified}`} className="grid gap-2 rounded-lg border border-border bg-surface p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center"><div className="min-w-0"><span className="block truncate text-xs font-semibold text-foreground">{file.name}</span>{result && <span className={`mt-1 block text-[10px] font-semibold ${failed ? 'text-destructive' : result.status === 'retrying' ? 'text-info' : 'text-success'}`}>{result.status === 'queued' ? 'Queued for review' : result.status === 'duplicate' ? 'Duplicate skipped' : result.status === 'retrying' ? 'Retrying…' : result.status === 'failed' ? (result.detail?.message || 'Upload failed') : result.status}</span>}</div><input value={uploadTags[index] || ''} disabled={complete || uploading} onChange={event => setUploadTags(current => current.map((value, tagIndex) => tagIndex === index ? event.target.value : value))} placeholder="Topics, comma separated" className="field text-xs disabled:opacity-60" />{failed ? <button type="button" onClick={() => void retryUpload(index)} disabled={uploading} className="inline-flex items-center justify-center rounded-lg border border-destructive/30 px-3 py-2 text-[11px] font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50">Retry</button> : <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{complete ? 'Done' : 'Ready'}</span>}</div> })}</div><button type="button" onClick={() => void handleSourceUpload()} disabled={uploading} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"><Upload size={14} /> {uploading ? 'Uploading…' : `Upload ${uploadFiles.length} file${uploadFiles.length === 1 ? '' : 's'}`}</button></section>}

    <section className="glass-panel rounded-2xl border border-border p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Find a document</p><p className="mt-1 text-xs text-muted-foreground">Use a filter when you know the department, topic, or status.</p></div><div className="flex items-center gap-3">{filtersActive && <button type="button" onClick={clearFilters} className="text-xs font-semibold text-muted-foreground hover:text-primary">Clear filters</button>}<Link to="/browse" className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:text-info"><FolderTree size={14} /> Browse hierarchy</Link></div></div><div className="flex flex-wrap items-center gap-2"><div className="flex min-w-[220px] flex-1 items-center rounded-lg border border-border bg-input px-3"><Search size={15} className="text-muted" /><input value={searchQuery} onChange={event => updateFilter(setSearchQuery, event.target.value)} placeholder="Search document titles…" className="w-full bg-transparent px-2 py-2 text-sm text-foreground outline-none" /></div><Select value={selectedDept} onChange={event => updateFilter(setSelectedDept, event.target.value)} className="w-full sm:w-44"><option value="">All departments</option>{departments.filter(item => item.active && item.company_domain === user?.company_domain).map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</Select><Select value={selectedTopic} onChange={event => updateFilter(setSelectedTopic, event.target.value)} className="w-full sm:w-40"><option value="">All topics</option>{tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</Select><Select value={selectedStatus} onChange={event => updateFilter(setSelectedStatus, event.target.value)} className="w-full sm:w-36"><option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="pending_review">Pending review</option></Select></div></section>

    {selectedArticleIds.length > 0 && <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"><span className="text-sm font-semibold text-foreground">{selectedArticleIds.length} selected</span><button type="button" onClick={() => void handleAutoTag()} disabled={autoTagging} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"><Sparkles size={14} /> {autoTagging ? 'Suggesting topics…' : 'Suggest topics'}</button></div>}

    <section className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-3"><button type="button" onClick={selectAllOnPage} aria-label="Select all documents on page" className="text-muted-foreground hover:text-primary">{articles.length > 0 && selectedArticleIds.length === articles.length ? <CheckSquare size={17} /> : <Square size={17} />}</button><span className="text-sm font-bold text-foreground">Documents</span></div><span className="text-xs text-muted-foreground">{articles.length ? `${offset + 1}–${offset + articles.length}` : '0'} on this page</span></div>
      {loading ? <div className="px-4 py-16 text-center text-sm text-muted-foreground">Loading documents…</div> : articles.length === 0 ? <div className="px-4 py-16 text-center"><FileText className="mx-auto text-muted" size={32} /><p className="mt-3 text-sm font-semibold text-foreground">No documents found</p><p className="mt-1 text-xs text-muted-foreground">Try a different filter or create a new document.</p></div> : <div className="space-y-2 p-2">{articles.map(article => { const articleTopics = (article.tags || []).map((tag: any) => typeof tag === 'string' ? tag : tag.tag).filter(Boolean); return <div key={article.id} className="grid gap-3 rounded-xl border border-border bg-surface p-4 shadow-[0_8px_20px_rgb(var(--shadow)/.06)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-soft md:grid-cols-[auto_minmax(0,1.7fr)_minmax(120px,.8fr)_minmax(110px,.7fr)_auto] md:items-center"><button type="button" onClick={() => toggleArticleSelection(article.id)} aria-label={`Select ${article.title}`} className="text-muted-foreground hover:text-primary">{selectedArticleIds.includes(article.id) ? <CheckSquare size={17} className="text-primary" /> : <Square size={17} />}</button><div className="min-w-0"><Link to={`/articles/${article.id}`} className="block truncate text-sm font-bold text-foreground hover:text-primary">{article.title}</Link><p className="mt-1 truncate text-xs text-muted-foreground">{article.owner?.name || article.owner || 'Unassigned'} · v{article.version}</p></div><div className="flex min-w-0 flex-wrap gap-1">{articleTopics.length ? articleTopics.slice(0, 2).map((topic: string) => <span key={topic} className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{topic}</span>) : <span className="text-xs text-muted">No topic</span>}</div><div><span className="rounded-full bg-surface-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{article.status?.replace('_', ' ')}</span><p className="mt-1 truncate text-xs text-muted-foreground">{article.dept}</p></div><Link to={`/articles/${article.id}`} className="text-xs font-bold text-primary hover:text-info">Open</Link></div> })}</div>}
      {!loading && articles.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3"><button type="button" disabled={offset <= 0} onClick={() => { setSelectedArticleIds([]); setOffset(current => Math.max(0, current - PAGE_SIZE)) }} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft size={14} /> Previous</button><span className="text-xs text-muted-foreground">Page {Math.floor(offset / PAGE_SIZE) + 1}</span><button type="button" disabled={articles.length < PAGE_SIZE} onClick={() => { setSelectedArticleIds([]); setOffset(current => current + PAGE_SIZE) }} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-40">Next <ArrowRight size={14} /></button></div>}
    </section>
  </div>
}

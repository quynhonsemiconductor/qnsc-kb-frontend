import { useCallback, useEffect, useState } from 'react'
import { Bot, History, Save } from 'lucide-react'
import { getMcpConfig, getMcpConfigHistory, saveMcpConfig, MCP_CONFIG_MAX_CHARS, type McpConfig, type McpConfigVersion } from '../../api/mcpConfig'
import PageHeader from '../../components/ui/PageHeader'
import { useDialog } from '../../components/ui/DialogProvider'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Textarea } from '../../components/ui/Textarea'
import { apiErrorDetail } from '../../lib/error-handler'
import { formatDateTime } from '../../lib/formatters'
import { describeSaveFailure } from './mcpConfigUtils'

export default function McpConfigPage() {
  const dialog = useDialog()
  const [config, setConfig] = useState<McpConfig | null>(null)
  const [draft, setDraft] = useState('')
  const [history, setHistory] = useState<McpConfigVersion[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Set by a 409: the text the editor held when the server's version moved on, kept so nothing typed is lost.
  const [lostDraft, setLostDraft] = useState<string | null>(null)
  const [stale, setStale] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const [current, versions] = await Promise.all([getMcpConfig(), getMcpConfigHistory().catch(failure => { console.error(failure); return [] as McpConfigVersion[] })])
    setConfig(current)
    setDraft(current.content_md)
    setHistory(versions)
  }, [])
  useEffect(() => { void load().catch(failure => setError(apiErrorDetail(failure) || 'The configuration could not be loaded.')) }, [load])

  if (!config) return <div className="page-shell p-8 text-muted-foreground">{error || 'Loading team configuration…'}</div>

  const changed = draft.trim() !== config.content_md.trim()
  const tooLong = draft.length > MCP_CONFIG_MAX_CHARS
  const save = async () => {
    if (!await dialog.confirm('Every team member\'s AI assistant will be told to copy this text into its CLAUDE.md the next time it connects. Check it contains nothing confidential.', { title: 'Publish team configuration', confirmLabel: 'Publish' })) return
    setSaving(true)
    setError('')
    try {
      await saveMcpConfig(draft, config.version)
      await load()
    } catch (failure) {
      const { message, stale } = describeSaveFailure(failure)
      setError(message)
      if (stale) { setLostDraft(draft); setStale(true) }
    } finally { setSaving(false) }
  }
  const loadLatest = async () => {
    try { await load(); setStale(false); setError('') }
    catch (failure) { setError(apiErrorDetail(failure) || 'The latest version could not be loaded.') }
  }

  return <div className="page-shell page-stack">
    <PageHeader eyebrow="Administration" title="Team AI configuration" description="Standing instructions every team member's AI assistant keeps in its CLAUDE.md. Change it here and each assistant updates itself the next time it connects." icon={Bot} />
    <section className="glass-panel rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={config.configured ? 'success' : 'default'} size="sm">{config.configured ? `Version ${config.version}` : 'Not configured yet'}</Badge>
        {config.updated_at && <span className="text-xs text-muted">Last published {formatDateTime(config.updated_at)}</span>}
      </div>
      <Textarea className="mt-4 min-h-72 resize-y font-mono text-sm" value={draft} onChange={event => setDraft(event.target.value)} aria-label="Team configuration" placeholder="For example: search the knowledge base before answering questions about the project, and record decisions with record_lesson." />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs ${tooLong ? 'text-destructive' : 'text-muted'}`}>{draft.length.toLocaleString()} / {MCP_CONFIG_MAX_CHARS.toLocaleString()} characters</span>
        <Button icon={<Save size={14} />} loading={saving} disabled={!changed || tooLong || !draft.trim() || saving || stale} onClick={save}>Publish</Button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {lostDraft !== null && <div className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-3">
        <Button size="sm" variant="secondary" onClick={() => void loadLatest()}>Load the latest version</Button>
        <details className="mt-3" open>
          <summary className="cursor-pointer text-xs font-semibold text-muted">Your text, kept so you can copy from it</summary>
          <Textarea readOnly className="mt-2 min-h-40 resize-y font-mono text-xs" value={lostDraft} aria-label="Your unpublished text" />
          <Button className="mt-2" size="sm" variant="ghost" onClick={() => setLostDraft(null)}>Done, hide my text</Button>
        </details>
      </div>}
      <p className="mt-4 text-xs text-muted">Assistants keep this between two marker lines in CLAUDE.md and replace only that block. The text is written by your administrators, so assistants are told to say what changed.</p>
    </section>
    {history.length > 0 && <section className="glass-panel rounded-2xl border border-border p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground"><History size={16} />Earlier versions</h2>
      <div className="mt-3 space-y-2">
        {history.map(item => <div key={item.version} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <span className="text-sm text-foreground">Version {item.version} <span className="text-xs text-muted">· {formatDateTime(item.created_at)}</span></span>
          {item.version !== config.version && <Button size="sm" variant="ghost" onClick={() => setDraft(item.content_md)}>Load into editor</Button>}
        </div>)}
      </div>
    </section>}
  </div>
}

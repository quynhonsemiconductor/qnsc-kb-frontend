import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Plus, ShieldAlert } from 'lucide-react'
import {
  createAccessToken, listAccessTokens, revokeAccessToken,
  type AccessTokenList, type AccessTokenScope, type CreatedAccessToken,
} from '../../api/accessTokens'
import client from '../../api/client'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useDialog } from '../ui/DialogProvider'
import { useToast } from '../ui/Toast'
import { useLanguage } from '../../i18n/LanguageProvider'
import { apiErrorDetail } from '../../lib/error-handler'
import { formatDateTime } from '../../lib/formatters'
import { claudeCodeCommand, clientConfigJson, lifetimeOptions, mcpEndpoint, tokenState } from '../../lib/accessTokens'

function CopyBlock({ label, value }: { label: string; value: string }) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable: the text is selectable on screen */
    }
  }
  return <div>
    <div className="flex items-center justify-between gap-2">
      <p className="text-caption font-semibold uppercase tracking-wider text-muted">{label}</p>
      <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption font-semibold text-primary hover:bg-surface-muted">
        {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? t('tokens.copied') : t('tokens.copy')}
      </button>
    </div>
    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-surface-muted p-2.5 text-caption text-foreground">{value}</pre>
  </div>
}

export function AccessTokensPanel() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const dialog = useDialog()
  const [data, setData] = useState<AccessTokenList | null>(null)
  const [failed, setFailed] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [name, setName] = useState('')
  const [scope, setScope] = useState<AccessTokenScope>('read')
  const [days, setDays] = useState(90)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<CreatedAccessToken | null>(null)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    try {
      const next = await listAccessTokens()
      setData(next)
      setFailed(false)
      setDays(current => (lifetimeOptions(next.max_days).includes(current) ? current : lifetimeOptions(next.max_days).at(-1) ?? current))
    } catch (error) {
      // 404 is the server saying MCP is switched off; hide the section's controls then.
      if ((error as { response?: { status?: number } })?.response?.status === 404) setDisabled(true)
      else setFailed(true)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      setCreated(await createAccessToken({ name: name.trim(), scope, expires_in_days: days }))
      setName('')
      await load()
    } catch (error) {
      toast('error', apiErrorDetail(error) || t('auth.genericError'))
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id: string) => {
    const ok = await dialog.confirm(t('tokens.revokeConfirm'), { title: t('tokens.revoke'), confirmLabel: t('tokens.revoke'), tone: 'danger' })
    if (!ok) return
    setBusy(id)
    try {
      await revokeAccessToken(id)
      if (created?.id === id) setCreated(null)
      toast('success', t('tokens.revoked'))
      await load()
    } catch (error) {
      toast('error', apiErrorDetail(error) || t('auth.genericError'))
    } finally {
      setBusy('')
    }
  }

  if (disabled) return <p className="text-body-sm text-muted-foreground">{t('tokens.disabled')}</p>
  const url = data ? mcpEndpoint(client.defaults.baseURL, data.endpoint_path, window.location.origin) : ''
  const live = (data?.items || []).filter(item => tokenState(item) === 'active').length

  return <div className="space-y-4">
    {created && <div role="status" data-testid="token-created" className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
      <p className="flex items-start gap-2 text-body-sm font-semibold text-foreground"><ShieldAlert size={16} className="mt-0.5 shrink-0 text-warning" />{t('tokens.once')}</p>
      <CopyBlock label={t('tokens.token')} value={created.token} />
      <CopyBlock label={t('tokens.claudeCode')} value={claudeCodeCommand(url, created.token)} />
      <CopyBlock label={t('tokens.otherClients')} value={clientConfigJson(url, created.token)} />
      <Button type="button" variant="secondary" size="sm" onClick={() => setCreated(null)}>{t('tokens.done')}</Button>
    </div>}

    <form onSubmit={create} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end">
      <Input label={t('tokens.name')} value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder={t('tokens.namePlaceholder')} required />
      <label className="block text-body-sm font-semibold text-foreground">{t('tokens.access')}
        <Select value={scope} onChange={event => setScope(event.target.value as AccessTokenScope)} className="mt-1 w-full">
          <option value="read">{t('tokens.scopeRead')}</option>
          <option value="write">{t('tokens.scopeWrite')}</option>
        </Select>
      </label>
      <label className="block text-body-sm font-semibold text-foreground">{t('tokens.lifetime')}
        <Select value={days} onChange={event => setDays(Number(event.target.value))} className="mt-1 w-full">
          {lifetimeOptions(data?.max_days ?? 365).map(option => <option key={option} value={option}>{t('tokens.days', { count: option })}</option>)}
        </Select>
      </label>
      <Button type="submit" variant="primary" size="sm" icon={<Plus size={14} />} loading={creating} disabled={!name.trim() || (data ? live >= data.max_tokens : false)}>{t('tokens.create')}</Button>
    </form>
    <p className="text-caption text-muted-foreground">{scope === 'write' ? t('tokens.scopeWriteHint') : t('tokens.scopeReadHint')}</p>

    <details data-testid="token-usage" className="rounded-lg border border-border bg-surface-muted/40 p-3 text-body-sm">
      <summary className="cursor-pointer font-semibold text-foreground">{t('tokens.usage')}</summary>
      <div className="mt-2 space-y-2 text-muted-foreground">
        <p>{t('tokens.usageIntro')}</p>
        <ul className="list-disc space-y-1 pl-5 text-foreground">
          {['tokens.example1', 'tokens.example2', 'tokens.example3'].map(key => <li key={key}>{t(key)}</li>)}
        </ul>
        <p className="text-caption">{t('tokens.usageTip')}</p>
      </div>
    </details>

    {failed ? <p role="alert" className="text-body-sm text-destructive">{t('account.loadFailed')}</p>
      : !data ? <div className="h-16 animate-pulse rounded-lg bg-surface-muted" />
      : data.items.length === 0 ? <p className="text-body-sm text-muted-foreground">{t('tokens.empty')}</p>
      : <ul className="divide-y divide-border" data-testid="token-list">
        {data.items.map(item => {
          const state = tokenState(item)
          return <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-body-sm font-semibold text-foreground">
                {item.name}
                <code className="rounded bg-surface-muted px-1.5 py-0.5 text-caption font-normal text-muted-foreground">{item.prefix}…</code>
                <span className="rounded-md bg-surface-muted px-2 py-0.5 text-caption font-bold text-muted-foreground">{item.scope === 'write' ? t('tokens.scopeWriteShort') : t('tokens.scopeReadShort')}</span>
                {state !== 'active' && <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-caption font-bold text-destructive-text">{t(state === 'revoked' ? 'tokens.stateRevoked' : 'tokens.stateExpired')}</span>}
              </p>
              <p className="mt-0.5 text-caption text-muted-foreground">
                {[t('tokens.createdAt', { when: formatDateTime(item.created_at) }), t('tokens.expiresAt', { when: formatDateTime(item.expires_at) }), item.last_used_at ? t('tokens.lastUsed', { when: formatDateTime(item.last_used_at) }) : t('tokens.neverUsed')].join(' · ')}
              </p>
            </div>
            {state === 'active' && <Button type="button" variant="ghost" size="sm" loading={busy === item.id} onClick={() => void revoke(item.id)} className="text-destructive-text">{t('tokens.revoke')}</Button>}
          </li>
        })}
      </ul>}
  </div>
}

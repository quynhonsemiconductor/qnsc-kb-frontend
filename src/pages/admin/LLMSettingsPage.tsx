import React, { useEffect, useState } from 'react'
import { Check, KeyRound, Network, Save, Server, ShieldCheck, Sparkles } from 'lucide-react'
import { getLLMConfig, updateLLMConfig, type LLMConfig, type LLMProvider } from '../../api/llm'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'

const providerOptions: { value: LLMProvider; label: string; description: string; model: string; baseUrl: string }[] = [
  { value: 'openai', label: 'OpenAI', description: 'GPT models through the OpenAI API.', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1/chat/completions' },
  { value: 'glm', label: 'GLM / Z.ai Coding', description: 'GLM models through the Z.ai Coding API.', model: 'glm-4.5-flash', baseUrl: 'https://api.z.ai/api/coding/paas/v4/chat/completions' },
  { value: 'groq', label: 'Groq', description: 'Fast open models through Groq.', model: 'llama-3.3-70b-versatile', baseUrl: 'https://api.groq.com/openai/v1/chat/completions' },
]

export default function LLMSettingsPage() {
  const [config, setConfig] = useState<LLMConfig | null>(null)
  const [provider, setProvider] = useState<LLMProvider>('openai')
  const [model, setModel] = useState('gpt-4o-mini')
  const [baseUrl, setBaseUrl] = useState(providerOptions[0].baseUrl)
  const [apiKey, setApiKey] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void getLLMConfig().then(data => {
      setConfig(data)
      setProvider(data.provider)
      setModel(data.model)
      setBaseUrl(data.base_url)
      setEnabled(data.enabled)
    }).catch((requestError: any) => setError(requestError.response?.data?.detail || 'Could not load LLM settings')).finally(() => setLoading(false))
  }, [])

  const chooseProvider = (next: LLMProvider) => {
    const option = providerOptions.find(item => item.value === next)!
    setProvider(next)
    setModel(option.model)
    setBaseUrl(option.baseUrl)
    setMessage('')
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await updateLLMConfig({ enabled, provider, model: model.trim(), base_url: baseUrl.trim(), api_key: apiKey || undefined })
      setConfig(updated)
      setApiKey('')
      setMessage(`${providerOptions.find(item => item.value === provider)?.label} is now ${enabled ? 'enabled' : 'disabled'} for the workspace.`)
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'Could not save LLM settings')
    } finally {
      setSaving(false)
    }
  }

  return <div className="page-shell page-stack text-ink">
    <header className="page-hero glass-panel soft-grid relative mb-1 flex flex-col gap-4 overflow-hidden rounded-panel border border-border px-4 py-5 md:flex-row md:items-start md:justify-between sm:px-6 sm:py-6">
      <div><p className="text-caption font-bold uppercase tracking-[.18em] text-muted">Administration / AI</p><h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">AI provider</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Choose which LLM powers the assistant, document reading view, and AI tagging for the whole workspace.</p></div>
      <Badge variant={config?.enabled ? 'success' : 'default'} size="md" dot>{loading ? 'Loading…' : config?.enabled ? 'AI enabled' : 'AI disabled'}</Badge>
    </header>

    {(message || error) && <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? 'border-rose-400/25 bg-rose-500/10 text-rose-700' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700'}`}>{error || message}</div>}

    <form onSubmit={save} className="space-y-6">
      <section className="rounded-xl border border-hairline bg-surface p-5"><div className="mb-4 flex items-start gap-3"><div className="rounded-lg bg-cyan/10 p-2 text-cyan-700"><Sparkles size={18} /></div><div><h2 className="font-semibold">Select a provider</h2><p className="mt-1 text-xs text-steel">All supported providers use a compatible chat-completions endpoint.</p></div></div><div className="grid gap-3 md:grid-cols-3">{providerOptions.map(option => <button key={option.value} type="button" onClick={() => chooseProvider(option.value)} className={`rounded-xl border p-4 text-left transition ${provider === option.value ? 'border-cyan-600 bg-cyan-50/70 ring-1 ring-cyan/20' : 'border-hairline hover:border-cyan/50 hover:bg-surface-soft'}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{option.label}</span>{provider === option.value && <Check size={16} className="text-cyan-700" />}</div><p className="mt-2 text-xs leading-5 text-steel">{option.description}</p></button>)}</div></section>

      <section className="rounded-xl border border-hairline bg-surface p-5"><div className="mb-5 flex items-start gap-3"><div className="rounded-lg bg-cyan/10 p-2 text-cyan-700"><Server size={18} /></div><div><h2 className="font-semibold">Connection details</h2><p className="mt-1 text-xs text-steel">Use a model name supported by the selected provider. The endpoint normally needs to end with <code>/chat/completions</code>.</p></div></div><div className="grid gap-4 md:grid-cols-2">
        <Input id="llm-model" label="Model" required value={model} onChange={event => setModel(event.target.value)} placeholder="Model name" />
        <div>
          <Input id="llm-key" label="API key" type="password" leftIcon={<KeyRound size={15} />} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={config?.api_key_hint || 'Paste a new API key'} autoComplete="new-password" hint="Leave blank to keep the saved key. It is never shown in full." />
        </div>
        <div className="md:col-span-2">
          <Input id="llm-endpoint" label="API endpoint" required readOnly={!config?.allow_custom_base_url} leftIcon={<Network size={15} />} value={baseUrl} onChange={event => setBaseUrl(event.target.value)} hint={config?.allow_custom_base_url ? 'Use only a trusted public HTTPS endpoint.' : 'Official provider endpoints are locked to protect the workspace API key.'} />
        </div>
      </div></section>

      <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="rounded-lg bg-success/10 p-2 text-success-text"><ShieldCheck size={18} /></div><div><h2 className="font-semibold">Use this provider</h2><p className="mt-1 text-xs text-steel">Disabling it makes AI features unavailable until another provider is configured.</p></div></div><button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled(current => !current)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${enabled ? 'border-success/30 bg-success/10 text-success-text' : 'border-border bg-canvas text-muted-foreground'}`}><span className={`h-4 w-4 rounded-full ${enabled ? 'bg-success' : 'bg-muted/40'}`} />{enabled ? 'Enabled' : 'Disabled'}</button></section>

      <div className="flex justify-end"><Button type="submit" variant="primary" disabled={saving || loading} loading={saving} icon={<Save size={15} />}>{saving ? 'Saving…' : 'Save AI provider'}</Button></div>
    </form>
  </div>
}

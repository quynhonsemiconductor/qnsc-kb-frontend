import React, { useEffect, useMemo, useState } from 'react'
import { Check, CheckCircle2, FlaskConical, KeyRound, Network, Save, Server, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react'
import { getLLMConfig, testLLMConfig, updateLLMConfig, type LLMConfig, type LLMProvider, type LLMTestResult } from '../../api/llm'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'

type ProviderOption = {
  value: LLMProvider
  label: string
  description: string
  model: string
  baseUrl: string
  endpointHint: string
}

const providerOptions: ProviderOption[] = [
  { value: 'openai', label: 'OpenAI', description: 'GPT models through the official OpenAI API.', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1/chat/completions', endpointHint: 'Official endpoint; managed automatically.' },
  { value: 'gemini', label: 'Google Gemini', description: 'Gemini models through Google’s native API.', model: 'gemini-2.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', endpointHint: 'Gemini API root; managed automatically.' },
  { value: 'glm', label: 'GLM / Z.ai', description: 'GLM models through the Z.ai Coding API.', model: 'glm-4.5-flash', baseUrl: 'https://api.z.ai/api/coding/paas/v4/chat/completions', endpointHint: 'Official endpoint; managed automatically.' },
  { value: 'groq', label: 'Groq', description: 'Fast open models through Groq.', model: 'llama-3.3-70b-versatile', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', endpointHint: 'Official endpoint; managed automatically.' },
  { value: 'custom', label: 'OpenAI-compatible API', description: 'Any trusted public API that implements Chat Completions.', model: '', baseUrl: '', endpointHint: 'Enter the full public HTTPS Chat Completions URL, usually ending in /chat/completions.' },
]

const getErrorMessage = (requestError: any, fallback: string) => requestError?.response?.data?.detail || fallback

function draftSignature(provider: LLMProvider, model: string, baseUrl: string, apiKey: string, hasSavedKey: boolean) {
  return JSON.stringify({ provider, model: model.trim(), baseUrl: baseUrl.trim(), key: apiKey || (hasSavedKey ? '__saved__' : '') })
}

export default function LLMSettingsPage() {
  const [config, setConfig] = useState<LLMConfig | null>(null)
  const [provider, setProvider] = useState<LLMProvider>('openai')
  const [model, setModel] = useState('gpt-4o-mini')
  const [baseUrl, setBaseUrl] = useState(providerOptions[0].baseUrl)
  const [apiKey, setApiKey] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<(LLMTestResult & { signature: string }) | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void getLLMConfig().then(data => {
      setConfig(data)
      setProvider(data.provider)
      setModel(data.model)
      setBaseUrl(data.base_url)
      setEnabled(data.enabled)
    }).catch((requestError: any) => setError(getErrorMessage(requestError, 'Could not load LLM settings'))).finally(() => setLoading(false))
  }, [])

  const signature = useMemo(
    () => draftSignature(provider, model, baseUrl, apiKey, Boolean(config?.api_key_configured && provider === config.provider)),
    [apiKey, baseUrl, config?.api_key_configured, config?.provider, model, provider],
  )
  const savedSignature = config ? draftSignature(config.provider, config.model, config.base_url, '', config.api_key_configured) : ''
  const connectionChanged = signature !== savedSignature
  const verified = Boolean(testResult && testResult.signature === signature)
  const mayReuseSavedKey = Boolean(config?.api_key_configured && provider === config.provider)
  const detailsReady = Boolean(model.trim() && baseUrl.trim() && (apiKey || mayReuseSavedKey))
  const option = providerOptions.find(item => item.value === provider) || providerOptions[0]
  const endpointEditable = provider === 'custom' || Boolean(config?.allow_custom_base_url)
  const needsVerification = connectionChanged
  const canSave = !loading && detailsReady && (!needsVerification || verified)

  const chooseProvider = (next: LLMProvider) => {
    const selected = providerOptions.find(item => item.value === next)!
    setProvider(next)
    setModel(selected.model)
    setBaseUrl(selected.baseUrl)
    setTestResult(null)
    setMessage('')
    setError('')
  }

  const testConnection = async () => {
    setTesting(true)
    setError('')
    setMessage('')
    const testedSignature = signature
    try {
      const result = await testLLMConfig({ provider, model: model.trim(), base_url: baseUrl.trim(), api_key: apiKey || undefined })
      setTestResult({ ...result, signature: testedSignature })
      setMessage(`Connection verified in ${result.latency_ms} ms. You can now save and activate this provider.`)
    } catch (requestError: any) {
      setTestResult(null)
      setError(getErrorMessage(requestError, 'Connection test failed. Check the endpoint, model, and API key.'))
    } finally {
      setTesting(false)
    }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await updateLLMConfig({
        enabled,
        provider,
        model: model.trim(),
        base_url: baseUrl.trim(),
        api_key: apiKey || undefined,
        verification_token: verified ? testResult!.verification_token : undefined,
      })
      setConfig(updated)
      setApiKey('')
      setTestResult(null)
      setMessage(`${option.label} is now ${enabled ? 'active' : 'saved but disabled'} for the workspace.`)
    } catch (requestError: any) {
      setError(getErrorMessage(requestError, 'Could not save LLM settings'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="page-shell page-stack text-ink">
    <header className="page-hero glass-panel soft-grid relative mb-1 flex flex-col gap-4 overflow-hidden rounded-panel border border-border px-4 py-5 sm:px-6 sm:py-6 md:flex-row md:items-start md:justify-between">
      <div><p className="text-caption font-bold uppercase tracking-[.18em] text-muted">Administration / AI</p><h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">AI provider</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Configure, verify, then activate the model that powers workspace AI. A changed connection can never go live before it passes a real request.</p></div>
      <Badge variant={config?.enabled ? 'success' : 'default'} size="md" dot>{loading ? 'Loading…' : config?.enabled ? 'AI active' : 'AI disabled'}</Badge>
    </header>

    {(message || error) && <div role={error ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-400/25 bg-rose-500/10 text-destructive-text' : 'border-emerald-400/25 bg-emerald-500/10 text-success-text'}`}>{error ? <TriangleAlert size={17} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0" />}<span>{error || message}</span></div>}

    <form onSubmit={save} className="space-y-5">
      <section className="rounded-[22px] border border-border bg-surface p-5 shadow-[0_12px_30px_rgb(var(--shadow)/.05)] sm:p-6">
        <div className="mb-5 flex items-start gap-3"><div className="rounded-xl bg-info/10 p-2.5 text-info"><Sparkles size={18} /></div><div><div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-info text-caption font-bold text-white">1</span><h2 className="font-bold text-foreground">Choose a provider</h2></div><p className="mt-1 text-xs text-muted-foreground">Use a known service or connect any OpenAI-compatible Chat Completions API.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{providerOptions.map(item => <button key={item.value} type="button" onClick={() => chooseProvider(item.value)} aria-pressed={provider === item.value} className={`rounded-2xl border p-4 text-left transition ${provider === item.value ? 'border-info/50 bg-info/8 ring-1 ring-info/15' : 'border-border hover:border-info/30 hover:bg-surface-soft'}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-foreground">{item.label}</span>{provider === item.value && <Check size={16} className="shrink-0 text-info" />}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p></button>)}</div>
      </section>

      <section className="rounded-[22px] border border-border bg-surface p-5 shadow-[0_12px_30px_rgb(var(--shadow)/.05)] sm:p-6">
        <div className="mb-5 flex items-start gap-3"><div className="rounded-xl bg-info/10 p-2.5 text-info"><Server size={18} /></div><div><div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-info text-caption font-bold text-white">2</span><h2 className="font-bold text-foreground">Connection details</h2></div><p className="mt-1 text-xs text-muted-foreground">Credentials stay encrypted on the server and are sent only to the endpoint shown here.</p></div></div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input id="llm-model" label="Model" required value={model} onChange={event => { setModel(event.target.value); setTestResult(null) }} placeholder={provider === 'custom' ? 'e.g. deepseek-chat' : 'Model name'} />
          <Input id="llm-key" label="API key" type="password" leftIcon={<KeyRound size={15} />} value={apiKey} onChange={event => { setApiKey(event.target.value); setTestResult(null) }} placeholder={config?.api_key_hint || 'Paste an API key'} autoComplete="new-password" hint="Leave blank to test with the saved key. The key is never returned to this page." />
          <div className="md:col-span-2"><Input id="llm-endpoint" label={provider === 'gemini' ? 'API root' : 'Chat Completions endpoint'} required readOnly={!endpointEditable} leftIcon={<Network size={15} />} value={baseUrl} onChange={event => { setBaseUrl(event.target.value); setTestResult(null) }} hint={option.endpointHint} /></div>
        </div>
        {provider === 'custom' && <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/8 px-3.5 py-3 text-xs leading-5 text-warning-text"><ShieldCheck size={15} className="mt-0.5 shrink-0" /><span>Only public HTTPS endpoints are accepted. Local, private, reserved, credential-bearing, redirected, or non-standard-port destinations are blocked by the server.</span></div>}
      </section>

      <section className={`rounded-[22px] border p-5 shadow-[0_12px_30px_rgb(var(--shadow)/.05)] sm:p-6 ${verified ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-border bg-surface'}`}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><div className={`rounded-xl p-2.5 ${verified ? 'bg-success/10 text-success-text' : 'bg-info/10 text-info'}`}>{verified ? <CheckCircle2 size={18} /> : <FlaskConical size={18} />}</div><div><div className="flex items-center gap-2"><span className={`grid h-5 w-5 place-items-center rounded-full text-caption font-bold text-white ${verified ? 'bg-success' : 'bg-info'}`}>3</span><h2 className="font-bold text-foreground">Test before activation</h2>{verified && <Badge variant="success" size="sm">Verified · {testResult?.latency_ms} ms</Badge>}</div><p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">The server sends a tiny request to this exact endpoint and model. Testing does not replace the currently active provider.</p></div></div><Button type="button" variant={verified ? 'secondary' : 'primary'} onClick={() => void testConnection()} disabled={!detailsReady || loading || saving} loading={testing} icon={<FlaskConical size={15} />}>{testing ? 'Testing connection…' : verified ? 'Test again' : 'Test connection'}</Button></div>
      </section>

      <section className="rounded-[22px] border border-border bg-surface p-5 shadow-[0_12px_30px_rgb(var(--shadow)/.05)] sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="rounded-xl bg-success/10 p-2.5 text-success-text"><ShieldCheck size={18} /></div><div><div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-info text-caption font-bold text-white">4</span><h2 className="font-bold text-foreground">Activate for workspace AI</h2></div><p className="mt-1 text-xs text-muted-foreground">Disabling preserves this configuration, but AI features remain unavailable until it is enabled again.</p></div></div><button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled(current => !current)} className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold ${enabled ? 'border-success/30 bg-success/10 text-success-text' : 'border-border bg-canvas text-muted-foreground'}`}><span className={`h-4 w-4 rounded-full ${enabled ? 'bg-success' : 'bg-muted/40'}`} />{enabled ? 'Will be active' : 'Saved only'}</button></div></section>

      {needsVerification && !verified && <p role="status" className="flex items-center justify-end gap-2 text-xs font-semibold text-warning-text"><TriangleAlert size={14} />Test the current connection before saving it as active.</p>}
      <div className="flex justify-end"><Button type="submit" variant="primary" disabled={!canSave || testing} loading={saving} icon={<Save size={15} />}>{saving ? 'Saving…' : enabled ? 'Save & use provider' : 'Save disabled provider'}</Button></div>
    </form>
  </div>
}

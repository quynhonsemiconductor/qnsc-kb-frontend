import React, { useEffect, useState } from 'react'
import { Check, Settings2, Sparkles } from 'lucide-react'
import { getFeatureFlags, updateFeatureFlag } from '../../api/governance'
import PageHeader from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'

type FeatureFlag = {
  key: string
  label: string
  description: string
  enabled: boolean
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setFlags(await getFeatureFlags())
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || 'Could not load feature controls.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const toggle = async (flag: FeatureFlag) => {
    setSavingKey(flag.key)
    setError('')
    setMessage('')
    try {
      const updated = await updateFeatureFlag(flag.key, !flag.enabled)
      setFlags(current => current.map(item => item.key === flag.key ? { ...item, ...updated } : item))
      setMessage(`${flag.label} is now ${updated.enabled ? 'enabled' : 'disabled'}.`)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || 'Could not update this feature.')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <main className="page-shell page-stack text-ink">
      <PageHeader eyebrow="Administration" title="Feature controls" description="Turn optional AI and knowledge-base capabilities on or off for the workspace. Changes apply to new processing jobs." icon={Settings2} />

      {(message || error) && <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? 'border-rose-400/25 bg-rose-500/10 text-rose-200' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'}`}>{error || message}</div>}

      <section className="space-y-3">
        {loading ? <div className="rounded-xl border border-hairline bg-surface p-5 text-sm text-steel">Loading feature controls…</div> : flags.map(flag => (
          <article key={flag.key} className="glass-panel interactive-lift flex flex-col gap-4 rounded-2xl border border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan/10 text-cyan"><Sparkles size={17} /></div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ink">{flag.label || flag.key}</h2>
                <p className="mt-1 text-xs leading-5 text-steel">{flag.description || flag.key}</p>
                <p className="mt-1 text-caption uppercase tracking-wider text-stone">{flag.key} · Workspace-wide</p>
              </div>
            </div>
            <Button
              type="button"
              role="switch"
              aria-checked={flag.enabled}
              disabled={savingKey === flag.key}
              onClick={() => void toggle(flag)}
              variant={flag.enabled ? 'primary' : 'secondary'}
              size="sm"
              loading={savingKey === flag.key}
              icon={!savingKey || savingKey !== flag.key ? <span className={`grid h-4 w-4 place-items-center rounded-full ${flag.enabled ? 'bg-emerald-400 text-[#102017]' : 'bg-surface-soft'}`}>{flag.enabled && <Check size={11} />}</span> : undefined}
              className={flag.enabled ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20' : ''}
            >
              {savingKey === flag.key ? 'Saving…' : flag.enabled ? 'Enabled' : 'Disabled'}
            </Button>
          </article>
        ))}
      </section>
    </main>
  )
}

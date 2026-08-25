import React, { createContext, useCallback, useContext, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

type DialogOptions = { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; tone?: 'info' | 'danger' | 'success' }
type PromptOptions = Omit<DialogOptions, 'message'> & { defaultValue?: string; placeholder?: string; multiline?: boolean; validate?: (value: string) => string | undefined }
type DialogState = DialogOptions & { kind: 'alert' | 'confirm' | 'prompt'; resolve: (value: any) => void; prompt?: PromptOptions }
type DialogApi = { alert: (message: string, options?: Omit<DialogOptions, 'message'>) => Promise<void>; confirm: (message: string, options?: Omit<DialogOptions, 'message'>) => Promise<boolean>; prompt: (message: string, options?: PromptOptions) => Promise<string | null> }
const DialogContext = createContext<DialogApi | null>(null)

export function useDialog() {
  const value = useContext(DialogContext)
  if (!value) throw new Error('useDialog must be used inside DialogProvider')
  return value
}

export default function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [promptValue, setPromptValue] = useState('')
  const [promptError, setPromptError] = useState('')
  const open = useCallback((kind: DialogState['kind'], message: string, options: Omit<DialogOptions, 'message'> = {}) => new Promise<boolean>(resolve => setDialog({ kind, message, resolve, ...options })), [])
  const close = (result: boolean | string | null) => { dialog?.resolve(dialog?.kind === 'prompt' && typeof result !== 'string' ? null : result); setDialog(null); setPromptError('') }
  const prompt = (message: string, options: PromptOptions = {}) => new Promise<string | null>(resolve => { setPromptValue(options.defaultValue || ''); setPromptError(''); setDialog({ kind: 'prompt', message, resolve, ...options, prompt: options }) })
  const api: DialogApi = { alert: (message, options) => open('alert', message, options).then(() => undefined), confirm: (message, options) => open('confirm', message, options).then(Boolean), prompt }
  const tone = dialog?.tone || (dialog?.kind === 'confirm' ? 'info' : 'danger')
  const Icon = tone === 'danger' ? AlertTriangle : tone === 'success' ? CheckCircle2 : Info
  const submitPrompt = () => { const value = promptValue.trim(); const error = dialog?.prompt?.validate?.(value); if (error) { setPromptError(error); return } close(value) }
  return <DialogContext.Provider value={api}>{children}{dialog && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/75 p-md backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={event => { if (event.key === 'Escape') close(false) }}><div className="dialog-scroll w-full max-w-xl max-h-[min(42rem,calc(100dvh-3rem))] overflow-y-auto rounded-panel border border-border bg-surface p-xl shadow-2xl"><div className="flex items-start gap-md"><div className={`rounded-surface p-sm ${tone === 'danger' ? 'bg-destructive/15 text-destructive' : tone === 'success' ? 'bg-success/15 text-success' : 'bg-info/15 text-info'}`}><Icon size={20} /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-md"><h2 id="dialog-title" className="text-h4 font-semibold text-foreground">{dialog.title || (dialog.kind === 'confirm' ? 'Please confirm' : dialog.kind === 'prompt' ? 'Provide a value' : 'Notice')}</h2><button type="button" onClick={() => close(false)} className="ui-icon-button ui-button-sm text-muted-foreground hover:bg-surface-soft hover:text-foreground" aria-label="Close dialog"><X size={16} /></button></div><p className="mt-sm whitespace-pre-wrap text-body leading-relaxed text-muted-foreground">{dialog.message}</p>{dialog.kind === 'prompt' && (dialog.prompt?.multiline ? <textarea autoFocus value={promptValue} onChange={event => setPromptValue(event.target.value)} placeholder={dialog.prompt.placeholder} className="ui-control mt-md min-h-28 resize-y" /> : <input autoFocus value={promptValue} onChange={event => setPromptValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') submitPrompt() }} placeholder={dialog.prompt?.placeholder} className="ui-control mt-md" />)}{promptError && <p className="mt-xs text-body-sm text-destructive">{promptError}</p>}</div></div><div className="mt-xl flex justify-end gap-xs">{dialog.kind !== 'alert' && <button type="button" onClick={() => close(false)} className="ui-button border border-border bg-surface text-muted-foreground hover:bg-surface-soft">{dialog.cancelLabel || 'Cancel'}</button>}<button type="button" autoFocus={dialog.kind !== 'prompt'} onClick={() => dialog.kind === 'prompt' ? submitPrompt() : close(true)} className={`ui-button text-primary-foreground ${tone === 'danger' ? 'bg-destructive hover:bg-destructive/90' : tone === 'success' ? 'bg-success hover:bg-success/90' : 'bg-info hover:bg-info/90'}`}>{dialog.kind === 'confirm' || dialog.kind === 'prompt' ? dialog.confirmLabel || 'Confirm' : dialog.confirmLabel || 'OK'}</button></div></div></div>}</DialogContext.Provider>
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { previewSourceEdit, submitSourceEdit, type SourceEditResult } from '../../api/articles'
import { Button } from '../ui/Button'
import { useDialog } from '../ui/DialogProvider'
import { useLanguage } from '../../i18n/LanguageProvider'
import {
  MAX_PENDING_EDITS,
  canQueue,
  describeEdit,
  editErrorMessage,
  missingTexts,
  placePopover,
  selectionProblem,
  toPayloadRow,
  type EditCounts,
  type PendingEdit,
  type SelectionInfo,
} from '../../lib/selectionEdit'

const POPOVER = { width: 320, height: 200 }

/**
 * The correction controls that sit over a document: a popover next to the selected text, and a
 * bar listing the corrections queued so far.
 *
 * The reader selects words in the original file, types what they should say, and applies it;
 * nothing is sent until they submit the queued corrections together. For each selection the page
 * asks the server how many places match, once with the text around the selection (is THIS
 * occurrence found?) and once without (how many are there altogether?), so it can offer "change
 * all N" only when there are several and can warn when the chosen spot cannot be located.
 */
export default function PaneEditor({
  articleId,
  version,
  selection,
  pending,
  onQueue,
  onDismiss,
  onRemove,
  onClear,
  onSubmitted,
}: {
  articleId: string
  version: number
  selection: SelectionInfo | null
  pending: PendingEdit[]
  onQueue: (edit: PendingEdit) => void
  onDismiss: () => void
  onRemove: (id: string) => void
  onClear: () => void
  onSubmitted: (result: SourceEditResult) => void
}) {
  const { t } = useLanguage()
  const dialog = useDialog()
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [missing, setMissing] = useState<string[]>([])

  const submit = async () => {
    if (!pending.length || submitting) return
    const confirmed = await dialog.confirm(t('sourceEdit.confirmBody'), { title: t('sourceEdit.confirmTitle'), confirmLabel: t('sourceEdit.submit'), tone: 'info' })
    if (!confirmed) return
    setSubmitting(true)
    setMessage('')
    setMissing([])
    try {
      onSubmitted(await submitSourceEdit(articleId, pending.map(toPayloadRow), version))
    } catch (error) {
      const notFound = missingTexts(error)
      if (notFound) setMissing(notFound)
      setMessage(editErrorMessage(error, t('sourceEdit.submitFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {selection && (
        <SelectionPopover
          key={`${selection.page ?? 0}|${selection.before}|${selection.text}|${selection.after}`}
          articleId={articleId}
          version={version}
          selection={selection}
          pending={pending}
          onApply={onQueue}
          onDismiss={onDismiss}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface px-3 py-2" data-testid="pending-bar">
        {pending.length === 0 ? (
          <p className="text-caption text-muted-foreground">{t('select.hint')}</p>
        ) : (
          <>
            <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5" aria-label={t('select.queued')}>
              {pending.map(edit => (
                <li key={edit.id} className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-caption ${missing.includes(edit.find) ? 'border-destructive/40 bg-destructive/10 text-destructive-text' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
                  <span className="max-w-[16rem] truncate">{describeEdit(edit)}{edit.all ? ` · ${t('select.allTag')}` : ''}</span>
                  <button type="button" onClick={() => onRemove(edit.id)} aria-label={t('sourceEdit.removeRow')} className="rounded p-0.5 hover:bg-black/5"><X size={11} /></button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={submitting}>{t('select.clear')}</Button>
            <Button type="button" variant="primary" size="sm" loading={submitting} onClick={() => void submit()}>{t('select.submit', { count: pending.length })}</Button>
          </>
        )}
        {pending.length > 0 && message && !selection && <p role="alert" className="basis-full text-caption font-semibold text-destructive-text">{message}</p>}
      </div>
    </>
  )
}

function SelectionPopover({
  articleId,
  version,
  selection,
  pending,
  onApply,
  onDismiss,
}: {
  articleId: string
  version: number
  selection: SelectionInfo
  pending: PendingEdit[]
  onApply: (edit: PendingEdit) => void
  onDismiss: () => void
}) {
  const { t } = useLanguage()
  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(selection.text)
  const [all, setAll] = useState(false)
  const [counts, setCounts] = useState<EditCounts | null>(null)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('')

  const problem = selection.multiline ? 'multiline' : selectionProblem(selection.text)

  // Ask the server where the selection lands.
  useEffect(() => {
    if (problem) return
    let alive = true
    setChecking(true)
    const timer = window.setTimeout(async () => {
      try {
        const find = selection.text
        const [here, anywhere] = await Promise.all([
          previewSourceEdit(articleId, [{ find, replace: `${find}​`, before: selection.before, after: selection.after, page: selection.page }], version),
          previewSourceEdit(articleId, [{ find, replace: `${find}​` }], version),
        ])
        if (alive) setCounts({ selected: here.counts[0] ?? 0, everywhere: anywhere.counts[0] ?? 0 })
      } catch (error) {
        if (alive) {
          setCounts(null)
          setMessage(editErrorMessage(error, t('select.checkFailed')))
        }
      } finally {
        if (alive) setChecking(false)
      }
    }, 250)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [selection, problem, articleId, version, t])

  const place = useMemo(
    () => placePopover(selection.rect, { width: window.innerWidth, height: window.innerHeight }, POPOVER),
    [selection],
  )

  const queueState = canQueue(pending, selection.text, draft)
  const located = counts ? (all ? counts.everywhere : counts.selected) : null
  const canApply = !problem && queueState === 'ok' && !checking && (located ?? 0) > 0

  const apply = () => {
    if (!canApply) return
    onApply({
      id: `${Date.now()}-${pending.length}`,
      find: selection.text,
      replace: draft,
      before: selection.before,
      after: selection.after,
      page: selection.page,
      all,
      overlay: selection.overlay,
    })
  }


  return (
        <div
          role="dialog"
          aria-label={t('select.title')}
          data-testid="select-popover"
          onMouseDown={event => event.stopPropagation()}
          onKeyDown={event => { if (event.key === 'Escape') onDismiss(); if (event.key === 'Enter' && canApply) { event.preventDefault(); apply() } }}
          className="fixed z-[60] rounded-xl border border-border bg-surface p-3 shadow-popover"
          style={{ left: place.left, top: place.top, width: POPOVER.width }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-caption text-muted-foreground">{t('select.selected')}: <span className="font-semibold text-foreground">“{selection.text}”</span></p>
            <button type="button" onClick={onDismiss} aria-label={t('sourceEdit.close')} className="shrink-0 rounded p-0.5 text-muted hover:bg-surface-muted"><X size={14} /></button>
          </div>
          {problem ? (
            <p className="mt-2 text-xs text-warning-text">{t(`select.problem.${problem}`)}</p>
          ) : (
            <>
              <input
                ref={input}
                autoFocus
                onFocus={event => event.target.select()}
                value={draft}
                maxLength={500}
                onChange={event => setDraft(event.target.value)}
                aria-label={t('select.replaceWith')}
                placeholder={t('select.replaceWith')}
                className="mt-2 w-full rounded-lg border border-border bg-input px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              />
              <div role="status" className="mt-1.5 min-h-[1.25rem] space-y-1 text-caption">
                {checking && <p className="text-muted-foreground">{t('select.checking')}</p>}
                {!checking && counts && counts.everywhere === 0 && <p className="text-warning-text">{t('select.notInFile')}</p>}
                {!checking && counts && counts.everywhere > 0 && counts.selected === 0 && !all && <p className="text-warning-text">{t('select.cannotLocate', { count: counts.everywhere })}</p>}
                {!checking && counts && counts.everywhere > 1 && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
                    <input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)} />
                    {t('select.changeAll', { count: counts.everywhere })}
                  </label>
                )}
                {queueState === 'same' && <p className="text-muted-foreground">{t('select.same')}</p>}
                {queueState === 'full' && <p className="text-warning-text">{t('select.full', { max: MAX_PENDING_EDITS })}</p>}
                {message && <p role="alert" className="text-destructive-text">{message}</p>}
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>{t('select.cancel')}</Button>
                <Button type="button" variant="primary" size="sm" disabled={!canApply} onClick={apply} icon={<Check size={14} />}>{t('select.apply')}</Button>
              </div>
            </>
          )}
        </div>
      
  )
}

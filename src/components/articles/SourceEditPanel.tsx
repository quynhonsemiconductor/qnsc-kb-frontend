import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { previewSourceEdit, submitSourceEdit, type SourceEditResult } from '../../api/articles'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useDialog } from '../ui/DialogProvider'
import { useLanguage } from '../../i18n/LanguageProvider'
import {
  MAX_EDIT_ROWS,
  MAX_EDIT_TEXT,
  canSubmit,
  countsByRow,
  editErrorMessage,
  filledRows,
  missingTexts,
  rowsProblem,
  type EditRow,
} from '../../utils/sourceEdit'

const blankRow = (): EditRow => ({ find: '', replace: '' })

/**
 * Correct text inside the stored original: type what the file says now and what it should say.
 *
 * Nothing changes until the reviewer has run the check, which counts where each line lands in
 * the file, and then confirms. The API stores the corrected file as a new version through the
 * normal approval, and keeps the file as it was uploaded.
 */
export default function SourceEditPanel({
  articleId,
  version,
  onSubmitted,
  onClose,
}: {
  articleId: string
  version: number
  onSubmitted: (result: SourceEditResult) => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  const dialog = useDialog()
  const [rows, setRows] = useState<EditRow[]>([blankRow()])
  // `counts` belongs to the rows as they were when checked; any edit to a row invalidates it.
  const [counts, setCounts] = useState<number[] | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'check' | 'submit' | null>(null)

  const change = (index: number, patch: Partial<EditRow>) => {
    setRows(current => current.map((row, position) => (position === index ? { ...row, ...patch } : row)))
    setCounts(null)
    setNotes([])
    setMissing([])
    setError('')
  }
  const remove = (index: number) => {
    setRows(current => (current.length === 1 ? [blankRow()] : current.filter((_, position) => position !== index)))
    setCounts(null)
    setMissing([])
  }

  const problem = rowsProblem(rows)
  const perRow = counts ? countsByRow(rows, counts) : []
  const body = filledRows(rows)

  const check = async () => {
    setBusy('check')
    setError('')
    setMissing([])
    try {
      const result = await previewSourceEdit(articleId, body, version)
      setCounts(result.counts)
      setNotes(result.notes)
    } catch (caught) {
      setCounts(null)
      setError(editErrorMessage(caught, t('sourceEdit.checkFailed')))
    } finally {
      setBusy(null)
    }
  }

  const submit = async () => {
    const confirmed = await dialog.confirm(t('sourceEdit.confirmBody'), {
      title: t('sourceEdit.confirmTitle'),
      confirmLabel: t('sourceEdit.submit'),
      tone: 'info',
    })
    if (!confirmed) return
    setBusy('submit')
    setError('')
    try {
      onSubmitted(await submitSourceEdit(articleId, body, version))
    } catch (caught) {
      const notFound = missingTexts(caught)
      if (notFound) setMissing(notFound)
      setError(editErrorMessage(caught, t('sourceEdit.submitFailed')))
    } finally {
      setBusy(null)
    }
  }

  const problemText = problem && problem !== 'empty' ? t(`sourceEdit.problem.${problem}`) : ''

  return (
    <section aria-label={t('sourceEdit.title')} className="space-y-3 rounded-xl border border-info/25 bg-info/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">{t('sourceEdit.title')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('sourceEdit.help')}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label={t('sourceEdit.close')} icon={<X size={14} />} />
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => {
          const count = perRow[index]
          const notFound = count === 0 || (row.find !== '' && missing.includes(row.find))
          return (
            <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
              <Input value={row.find} maxLength={MAX_EDIT_TEXT} onChange={event => change(index, { find: event.target.value })} placeholder={t('sourceEdit.find')} aria-label={t('sourceEdit.find')} className="text-xs" />
              <Input value={row.replace} maxLength={MAX_EDIT_TEXT} onChange={event => change(index, { replace: event.target.value })} placeholder={t('sourceEdit.replace')} aria-label={t('sourceEdit.replace')} className="text-xs" />
              <div className="flex items-center gap-2 sm:min-w-[9rem]">
                {typeof count === 'number' && (
                  <span role="status" className={`text-caption font-semibold ${notFound ? 'text-destructive-text' : 'text-success-text'}`}>
                    {notFound ? t('sourceEdit.notFound') : t('sourceEdit.found', { count })}
                  </span>
                )}
                {typeof count !== 'number' && notFound && <span className="text-caption font-semibold text-destructive-text">{t('sourceEdit.notFound')}</span>}
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} aria-label={t('sourceEdit.removeRow')} icon={<Trash2 size={14} />} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={rows.length >= MAX_EDIT_ROWS || busy !== null} onClick={() => setRows(current => [...current, blankRow()])} icon={<Plus size={14} />}>
          {t('sourceEdit.addRow')}
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={problem !== null || busy !== null} loading={busy === 'check'} onClick={() => void check()}>
          {t('sourceEdit.check')}
        </Button>
        <Button type="button" variant="primary" size="sm" disabled={!canSubmit(rows, counts) || busy !== null} loading={busy === 'submit'} onClick={() => void submit()}>
          {t('sourceEdit.submit')}
        </Button>
      </div>

      {problemText && <p className="text-xs text-warning-text">{problemText}</p>}
      {notes.map(note => <p key={note} className="text-xs text-muted-foreground">{note}</p>)}
      {error && <p role="alert" className="text-xs font-semibold text-destructive-text">{error}</p>}
    </section>
  )
}

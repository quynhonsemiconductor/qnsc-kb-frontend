import { useEffect, useMemo, useState } from 'react'
import { FileWarning, RefreshCw } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageProvider'
import { renderOffice, type OfficeLabels, type OfficeRendering } from '../../utils/officeRender'
import {
  ROWS_PER_PAGE,
  previewDocument,
  sheetPageCount,
  sheetPageHtml,
  type RenderableOfficeKind,
  type SheetLabels,
} from '../../utils/officePreview'

type State = { status: 'loading' } | { status: 'ready'; rendering: OfficeRendering } | { status: 'error' }

const tabClass = (active: boolean) =>
  `max-w-48 shrink-0 truncate rounded-t-md border border-b-0 px-3 py-1 text-caption font-semibold ${
    active ? 'border-border bg-white text-foreground' : 'border-transparent bg-surface-muted text-muted-foreground hover:text-foreground'
  }`

const pagerButton =
  'rounded-md border border-border bg-white px-2.5 py-0.5 text-caption font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40'

/**
 * A file the browser would not show, drawn in the review pane: Word, Excel, PowerPoint, TIFF
 * or BMP. It is parsed in the browser and never sent anywhere.
 *
 * The document is untrusted, so it is shown in an iframe with an EMPTY `sandbox` attribute:
 * no scripts, no forms, no popups, no same-origin access, and an opaque origin that cannot
 * read the app's cookies or storage. Its markup is built by code that escapes document text,
 * and the document carries its own CSP as a second layer. Do not loosen the sandbox:
 * `allow-scripts` would run the document's own scripts, and `allow-scripts` together with
 * `allow-same-origin` lets a document remove its sandbox entirely.
 *
 * It is a rendering, not the original: layout, fonts and some features can differ, and the
 * pane says so.
 *
 * A spreadsheet is reached sheet by sheet and 500 rows at a time, so every row can be read
 * without building a page too big for the tab.
 */
export default function OfficePreview({
  blob,
  kind,
  fileName,
}: {
  blob: Blob
  kind: RenderableOfficeKind
  fileName: string
}) {
  const { t } = useLanguage()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [sheetIndex, setSheetIndex] = useState(0)
  const [page, setPage] = useState(0)

  const labels = useMemo<OfficeLabels>(
    () => ({
      notes: t('drafts.pptxNotes'),
      slide: (number, total) => t('drafts.pptxSlide', { number, total }),
      placeholder: placeholderKind => t(`drafts.pptxPlaceholder.${placeholderKind}`),
      truncatedSlides: (shown, total) => t('drafts.pptxTruncatedSlides', { shown, total }),
      page: (number, total) => t('drafts.imagePage', { number, total }),
      truncatedPages: (shown, total) => t('drafts.imageTruncatedPages', { shown, total }),
      unreadablePage: number => t('drafts.imageUnreadablePage', { number }),
    }),
    [t],
  )
  const sheetLabels = useMemo<SheetLabels>(
    () => ({
      truncatedColumns: (shown, total) => t('drafts.officeTruncatedColumns', { shown, total }),
      emptySheet: t('drafts.officeEmptySheet'),
    }),
    [t],
  )

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    setSheetIndex(0)
    setPage(0)
    renderOffice(blob, kind, labels)
      .then(rendering => { if (!cancelled) setState({ status: 'ready', rendering }) })
      .catch(() => { if (!cancelled) setState({ status: 'error' }) })
    return () => { cancelled = true }
  }, [blob, kind, labels])

  const rendering = state.status === 'ready' ? state.rendering : null
  const sheets = rendering?.type === 'sheets' ? rendering.sheets : null
  const sheet = sheets ? sheets[Math.min(sheetIndex, sheets.length - 1)] : null
  const pageCount = sheet ? sheetPageCount(sheet.data.length) : 1

  const srcDoc = useMemo(() => {
    if (!rendering) return ''
    if (rendering.type === 'html') return rendering.html
    return previewDocument(sheet ? sheetPageHtml(sheet, page, sheetLabels) : '')
  }, [rendering, sheet, page, sheetLabels])

  if (state.status === 'loading') {
    return <div role="status" className="grid h-full place-items-center text-body-sm text-muted-foreground"><span className="flex items-center gap-2"><RefreshCw size={15} className="animate-spin" />{t('drafts.officePreviewLoading')}</span></div>
  }
  if (state.status === 'error') {
    return <div className="grid h-full place-items-center px-6 text-center"><div className="max-w-sm space-y-2"><FileWarning size={22} className="mx-auto text-muted" /><p className="text-body font-semibold text-foreground">{t('drafts.officePreviewFailed')}</p><p className="text-body-sm leading-5 text-muted-foreground">{t('drafts.sourceFileNotPreviewableHelp')}</p></div></div>
  }

  const firstRow = page * ROWS_PER_PAGE + 1
  const lastRow = sheet ? Math.min(sheet.data.length, (page + 1) * ROWS_PER_PAGE) : 0
  return (
    <div className="flex h-full flex-col bg-white">
      <p className="shrink-0 border-b border-border bg-surface-soft px-3 py-1.5 text-caption text-muted-foreground">{t('drafts.officePreviewNote')}</p>
      {sheets && sheets.length > 1 && (
        <div role="tablist" aria-label={t('drafts.officeSheets')} className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface-soft px-2 pt-1.5">
          {sheets.map((entry, index) => (
            <button key={index} type="button" role="tab" aria-selected={index === sheetIndex} onClick={() => { setSheetIndex(index); setPage(0) }} className={tabClass(index === sheetIndex)} title={entry.sheet}>
              {entry.sheet}
            </button>
          ))}
        </div>
      )}
      {sheet && pageCount > 1 && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface-soft px-3 py-1.5">
          <span role="status" className="text-caption text-muted-foreground">{t('drafts.officeRows', { from: firstRow, to: lastRow, total: sheet.data.length })}</span>
          <span className="flex gap-1.5">
            <button type="button" className={pagerButton} disabled={page === 0} onClick={() => setPage(current => Math.max(0, current - 1))}>{t('drafts.officePrevPage')}</button>
            <button type="button" className={pagerButton} disabled={page >= pageCount - 1} onClick={() => setPage(current => Math.min(pageCount - 1, current + 1))}>{t('drafts.officeNextPage')}</button>
          </span>
        </div>
      )}
      <iframe title={fileName} sandbox="" srcDoc={srcDoc} className="min-h-0 w-full flex-1 border-0 bg-white" />
    </div>
  )
}

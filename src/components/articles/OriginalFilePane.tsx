import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileWarning, RefreshCw } from 'lucide-react'
import OfficePreview from '../review/OfficePreview'
import PaneEditor from './PaneEditor'
import PdfTextViewer from './PdfTextViewer'
import PlainTextViewer from './PlainTextViewer'
import { downloadArticleSourceFile, type SourceEditResult } from '../../api/articles'
import { useLanguage } from '../../i18n/LanguageProvider'
import { trimSelection, type PendingEdit, type SelectionInfo } from '../../lib/selectionEdit'
import { detectOfficeKind, isRenderableOffice, type OfficeKind } from '../../utils/officePreview'
import { canInlineSourceType, sourcePreviewMode } from '../../utils/sourcePreview'

type Loaded = { url: string; type: string; blob: Blob; name: string; officeKind: OfficeKind | null }
type State = { status: 'loading' } | { status: 'missing' } | { status: 'failed' } | { status: 'ready'; file: Loaded }

/** Set to correct text by selecting it: the version the reader is looking at, and what to do after. */
export interface PaneEditing {
  version: number
  onSubmitted: (result: SourceEditResult) => void
}

/**
 * The stored original of a published article, drawn in the page.
 *
 * This is the same file the reviewer saw while approving it, so what readers see after
 * approval is the document that was actually uploaded rather than only the extracted text.
 * What each format becomes (PDF and images by the browser, Word/Excel/PowerPoint/TIFF/BMP by
 * the sandboxed Office preview, anything else a download) is decided by `sourcePreviewMode`,
 * the same rule the review pane uses.
 *
 * With `editing`, the file is drawn so its TEXT CAN BE SELECTED (a PDF by pdf.js, Office files
 * with a same-origin, script-free frame, text files as text), and selecting words offers to
 * correct them in place. A picture or a scan has no text to select and says so.
 */
export default function OriginalFilePane({ articleId, title, editing }: { articleId: string; title: string; editing?: PaneEditing }) {
  const { t } = useLanguage()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [pending, setPending] = useState<PendingEdit[]>([])
  const urlRef = useRef<string | null>(null)
  const selectionOpen = useRef(false)
  selectionOpen.current = selection !== null

  const release = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }

  const load = useCallback(async () => {
    release()
    setState({ status: 'loading' })
    try {
      const { url, type, blob, name } = await downloadArticleSourceFile(articleId)
      urlRef.current = url
      // Only a format the browser will not show itself needs identifying.
      const officeKind = canInlineSourceType(type) ? null : await detectOfficeKind(blob, name)
      setState({ status: 'ready', file: { url, type, blob, name: name || title, officeKind } })
    } catch (error: unknown) {
      // 404 is the API's answer for "no stored file" (an article written by hand).
      const code = (error as { response?: { status?: number } })?.response?.status
      setState({ status: code === 404 ? 'missing' : 'failed' })
    }
  }, [articleId, title])

  useEffect(() => {
    let current = true
    void load().then(() => { if (!current) release() })
    return () => { current = false; release() }
  }, [load])

  // Leaving edit mode drops what was selected and queued.
  useEffect(() => {
    if (!editing) {
      setSelection(null)
      setPending([])
    }
  }, [editing])

  // A selection is only replaced by another one: the popover's own input takes focus, which
  // clears the document's selection and must not close it.
  const handleSelect = useCallback((next: SelectionInfo | null) => {
    if (next === null) return
    setSelection(trimSelection(next))
  }, [])

  const notice = (icon: boolean, heading: string, help?: string, action?: React.ReactNode) => (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-sm space-y-3">
        {icon && <FileWarning size={22} className="mx-auto text-muted" />}
        <p className="text-body font-semibold text-foreground">{heading}</p>
        {help && <p className="text-body-sm leading-5 text-muted-foreground">{help}</p>}
        {action}
      </div>
    </div>
  )

  const render = () => {
    if (state.status === 'loading') {
      return <div role="status" className="grid h-full place-items-center text-body-sm text-muted-foreground"><span className="flex items-center gap-2"><RefreshCw size={15} className="animate-spin" />{t('original.loading')}</span></div>
    }
    if (state.status === 'missing') return notice(true, t('original.unavailable'))
    if (state.status === 'failed') {
      return notice(true, t('original.failed'), undefined, <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-control border border-border px-4 text-body-sm font-bold text-foreground">{t('original.retry')}</button>)
    }
    const { file } = state
    const mode = sourcePreviewMode({ url: file.url, mimeType: file.type, officeKind: file.officeKind })
    const onSelect = editing ? handleSelect : undefined
    if (mode === 'office' && isRenderableOffice(file.officeKind)) {
      const picture = file.officeKind === 'tiff' || file.officeKind === 'bmp'
      if (editing && picture) return notice(true, t('select.noText'), t('select.noTextHelp'))
      return <OfficePreview blob={file.blob} kind={file.officeKind} fileName={file.name} onSelect={onSelect} pending={pending} />
    }
    if (mode === 'download' || mode === 'office') {
      return notice(true, t('original.notPreviewable'), t('original.notPreviewableHelp'), <a href={file.url} download={file.name} className="inline-flex min-h-10 items-center gap-2 rounded-control bg-primary px-4 text-body-sm font-bold text-primary-foreground no-underline"><Download size={14} />{t('original.download')}</a>)
    }
    if (mode === 'image') {
      if (editing) return notice(true, t('select.noText'), t('select.noTextHelp'))
      return <div className="h-full overflow-auto bg-white p-4"><img src={file.url} alt={file.name} className="mx-auto max-w-full object-contain" /></div>
    }
    if (editing && file.type === 'application/pdf') return <PdfTextViewer blob={file.blob} onSelect={onSelect} pending={pending} />
    if (editing && file.type === 'text/plain') return <PlainTextViewer blob={file.blob} onSelect={onSelect} />
    // A frame, not an embed element: the app's CSP says `object-src 'none'`, which blocks embed and
    // object elements (the pane rendered blank), while `frame-src blob:` allows a frame. No `sandbox`,
    // for the reason given in PdfViewer: the blob is minted by this origin and a sandboxed frame
    // has an opaque origin that cannot load it.
    return <iframe src={file.url} title={file.name} className="size-full border-0 bg-white" />
  }

  return (
    <div
      className="flex h-[75vh] min-h-[24rem] flex-col overflow-hidden rounded-xl border border-border bg-surface-muted"
      // A click on the document (not on the popover, which stops propagation) puts the popover away.
      onMouseDownCapture={event => {
        const inPopover = event.target instanceof Element && event.target.closest('[data-testid="select-popover"]')
        if (selectionOpen.current && !inPopover) setSelection(null)
      }}
    >
      {editing && state.status === 'ready' && (
        <p className="shrink-0 border-b border-info/25 bg-info/10 px-3 py-1.5 text-caption font-semibold text-info-text">{t('select.banner')}</p>
      )}
      <div className="min-h-0 flex-1">{render()}</div>
      {editing && state.status === 'ready' && (
        <PaneEditor
          articleId={articleId}
          version={editing.version}
          selection={selection}
          pending={pending}
          onQueue={edit => { setPending(current => [...current, edit]); setSelection(null) }}
          onDismiss={() => setSelection(null)}
          onRemove={id => setPending(current => current.filter(edit => edit.id !== id))}
          onClear={() => setPending([])}
          onSubmitted={result => { setPending([]); setSelection(null); editing.onSubmitted(result) }}
        />
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { FileWarning, RefreshCw } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageProvider'
import { renderOfficeHtml } from '../../utils/officeRender'
import type { RenderableOfficeKind, SheetLabels } from '../../utils/officePreview'

type State = { status: 'loading' } | { status: 'ready'; html: string } | { status: 'error' }

/**
 * A Word or Excel file shown in the review pane, in the browser, without sending it anywhere.
 *
 * The document is untrusted, so it is shown in an iframe with an EMPTY `sandbox` attribute:
 * no scripts, no forms, no popups, no same-origin access, and an opaque origin that cannot
 * read the app's cookies or storage. Its markup is built by `renderOfficeHtml` and
 * `sheetsToHtml`, which escape cell text, and the document carries its own restrictive CSP as
 * a second layer. Do not loosen the sandbox: `allow-scripts` would run the document's own
 * scripts, and `allow-scripts` together with `allow-same-origin` lets a document remove its
 * sandbox entirely.
 *
 * It is a rendering, not the original: layout, fonts and some features can differ from Word
 * or Excel, and the pane says so.
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

  const labels = useMemo<SheetLabels>(
    () => ({
      truncatedRows: (shown, total) => t('drafts.officeTruncatedRows', { shown, total }),
      truncatedColumns: (shown, total) => t('drafts.officeTruncatedColumns', { shown, total }),
      emptySheet: t('drafts.officeEmptySheet'),
    }),
    [t],
  )

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    renderOfficeHtml(blob, kind, labels)
      .then(html => { if (!cancelled) setState({ status: 'ready', html }) })
      .catch(() => { if (!cancelled) setState({ status: 'error' }) })
    return () => { cancelled = true }
  }, [blob, kind, labels])

  if (state.status === 'loading') {
    return <div role="status" className="grid h-full place-items-center text-body-sm text-muted-foreground"><span className="flex items-center gap-2"><RefreshCw size={15} className="animate-spin" />{t('drafts.officePreviewLoading')}</span></div>
  }
  if (state.status === 'error') {
    return <div className="grid h-full place-items-center px-6 text-center"><div className="max-w-sm space-y-2"><FileWarning size={22} className="mx-auto text-muted" /><p className="text-body font-semibold text-foreground">{t('drafts.officePreviewFailed')}</p><p className="text-body-sm leading-5 text-muted-foreground">{t('drafts.sourceFileNotPreviewableHelp')}</p></div></div>
  }
  return (
    <div className="flex h-full flex-col bg-white">
      <p className="shrink-0 border-b border-border bg-surface-soft px-3 py-1.5 text-caption text-muted-foreground">{t('drafts.officePreviewNote')}</p>
      <iframe title={fileName} sandbox="" srcDoc={state.html} className="min-h-0 w-full flex-1 border-0 bg-white" />
    </div>
  )
}

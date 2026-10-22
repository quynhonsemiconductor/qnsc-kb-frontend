import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileWarning, RefreshCw } from 'lucide-react'
import OfficePreview from '../review/OfficePreview'
import { downloadArticleSourceFile } from '../../api/articles'
import { useLanguage } from '../../i18n/LanguageProvider'
import { detectOfficeKind, isRenderableOffice, type OfficeKind } from '../../utils/officePreview'
import { canInlineSourceType, sourcePreviewMode } from '../../utils/sourcePreview'

type Loaded = { url: string; type: string; blob: Blob; name: string; officeKind: OfficeKind | null }
type State = { status: 'loading' } | { status: 'missing' } | { status: 'failed' } | { status: 'ready'; file: Loaded }

/**
 * The stored original of a published article, drawn in the page.
 *
 * This is the same file the reviewer saw while approving it, so what readers see after
 * approval is the document that was actually uploaded rather than only the extracted text.
 * What each format becomes (PDF and images by the browser, Word/Excel/PowerPoint/TIFF/BMP by
 * the sandboxed Office preview, anything else a download) is decided by `sourcePreviewMode`,
 * the same rule the review pane uses.
 */
export default function OriginalFilePane({ articleId, title }: { articleId: string; title: string }) {
  const { t } = useLanguage()
  const [state, setState] = useState<State>({ status: 'loading' })
  const urlRef = useRef<string | null>(null)

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
    if (mode === 'office' && isRenderableOffice(file.officeKind)) return <OfficePreview blob={file.blob} kind={file.officeKind} fileName={file.name} />
    if (mode === 'download' || mode === 'office') {
      return notice(true, t('original.notPreviewable'), t('original.notPreviewableHelp'), <a href={file.url} download={file.name} className="inline-flex min-h-10 items-center gap-2 rounded-control bg-primary px-4 text-body-sm font-bold text-primary-foreground no-underline"><Download size={14} />{t('original.download')}</a>)
    }
    if (mode === 'image') return <div className="h-full overflow-auto bg-white p-4"><img src={file.url} alt={file.name} className="mx-auto max-w-full object-contain" /></div>
    return <embed src={file.url} type={file.type || 'application/pdf'} title={file.name} className="size-full bg-white" />
  }

  return <div className="h-[75vh] min-h-[24rem] overflow-hidden rounded-xl border border-border bg-surface-muted">{render()}</div>
}

import { useEffect, useState } from 'react'
import { Eye, EyeOff, Sparkles } from 'lucide-react'
import { downloadEvidencePreview } from '../../api/articles'
import type { FigureArtifact } from '../../types/ai'
import { useLanguage } from '../../i18n/LanguageProvider'

/**
 * A retrieved figure with the part the question is about outlined on top of it.
 *
 * The picture is the same preview the evidence viewer shows, fetched with the user's own
 * credentials; the outlines are separate elements positioned by percentage, so the original
 * is never altered and the reader can hide them to see it as it is. They are the model's
 * suggestion, and the caption says so.
 */
export default function FigureArtifactView({ figure }: { figure: FigureArtifact }) {
  const { t } = useLanguage()
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [marked, setMarked] = useState(true)

  useEffect(() => {
    let active = true
    let created: string | null = null
    setUrl(null)
    setFailed(false)
    downloadEvidencePreview(figure.article_id, figure.evidence_id)
      .then(({ url: blobUrl }) => {
        if (!active) {
          URL.revokeObjectURL(blobUrl)
          return
        }
        created = blobUrl
        setUrl(blobUrl)
      })
      .catch(() => { if (active) setFailed(true) })
    return () => {
      active = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [figure.article_id, figure.evidence_id])

  return (
    <figure className="rounded-xl border border-border bg-surface-elevated p-3" data-testid="figure-artifact">
      <figcaption className="mb-2 flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-body-sm font-semibold text-foreground">{figure.title}</span>
        {figure.source_id && <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-caption font-semibold text-muted-foreground">{figure.source_id}</span>}
        <button type="button" onClick={() => setMarked(value => !value)} aria-pressed={marked} className="ask-press inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-caption text-muted-foreground hover:bg-surface-muted hover:text-foreground">
          {marked ? <EyeOff size={12} /> : <Eye size={12} />}{marked ? t('agent.figure.hide') : t('agent.figure.show')}
        </button>
      </figcaption>
      {failed ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-body-sm text-muted-foreground">{t('agent.figure.unavailable')}</p>
      ) : !url ? (
        <div role="status" className="grid h-40 place-items-center text-body-sm text-muted-foreground">…</div>
      ) : (
        <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg bg-white">
          <img src={url} alt={figure.title} className="block max-h-[28rem] max-w-full object-contain" />
          {marked && figure.regions.map((region, index) => (
            <div
              key={index}
              data-testid="figure-region"
              className="pointer-events-none absolute rounded-md border-2 border-rose-500 bg-rose-500/10 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
              style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }}
            >
              {region.label && <span className="absolute -top-0.5 left-0 max-w-full -translate-y-full truncate rounded-t bg-rose-500 px-1.5 py-0.5 text-caption font-semibold text-white">{region.label}</span>}
            </div>
          ))}
        </div>
      )}
      {figure.caption && <p className="mt-2 text-body-sm text-muted-foreground">{figure.caption}</p>}
      <p className="mt-1 flex items-center gap-1 text-caption text-muted"><Sparkles size={11} />{t('agent.figure.aiNote')}</p>
    </figure>
  )
}

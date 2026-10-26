import { ExternalLink, SearchX } from 'lucide-react'
import type { Citation } from '../../types/ai'
import { useLanguage } from '../../i18n/LanguageProvider'

/**
 * "Not found in the knowledge base", shown as what it is.
 *
 * It used to render as the grounded-answer card (heading, GROUNDED badge) when the wording was
 * Vietnamese, which labelled a refusal as a verified answer, followed by a quoted passage that
 * stopped wherever its chunk did and read like a response cut off. Now the sentence stands
 * alone, and the nearest documents are listed beneath it with what they are and where to open
 * them. They are not an answer and are not cited as one.
 */
export default function RefusalCard({
  sentence,
  related,
  onOpen,
}: {
  sentence: string
  related: Citation[]
  onOpen: (citation: Citation) => void
}) {
  const { t } = useLanguage()
  return (
    <section className="rounded-surface border border-border bg-surface-elevated p-4" data-testid="refusal-card">
      <p className="flex items-center gap-2 text-caption font-bold uppercase tracking-widest text-muted-foreground">
        <span className="grid h-6 w-6 place-items-center rounded-control bg-surface-muted"><SearchX size={13} /></span>
        {t('ask.refusal.title')}
      </p>
      <p className="mt-2 text-body leading-6 text-foreground">{sentence}</p>
      {related.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-caption font-semibold text-muted-foreground">{t('ask.refusal.related')}</p>
          <ul className="mt-2 space-y-2">
            {related.map(source => (
              <li key={source.article_id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-semibold text-foreground">{source.title}</p>
                    <p className="mt-0.5 text-caption text-muted-foreground">
                      {[source.section_ref, source.page_number ? t('ask.refusal.page', { page: source.page_number }) : ''].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button type="button" onClick={() => onOpen(source)} className="ask-press inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-caption font-semibold text-foreground hover:bg-surface-muted">
                    <ExternalLink size={12} />{t('ask.refusal.open')}
                  </button>
                </div>
                {source.excerpt && <p className="mt-2 line-clamp-3 text-body-sm leading-5 text-muted-foreground">{source.excerpt}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-caption text-muted">{t('ask.refusal.unverified')}</p>
        </div>
      ) : (
        <p className="mt-3 text-body-sm text-muted-foreground">{t('ask.refusal.none')}</p>
      )}
    </section>
  )
}

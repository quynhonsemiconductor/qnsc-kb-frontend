import React from 'react'
import { ArrowLeft, Clock, History, LockKeyhole } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { useLanguage } from '../../i18n/LanguageProvider'

export default function ArticleHistoryPage() {
  const { t } = useLanguage()
  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow={t('history.eyebrow')} title={t('history.title')} description={t('history.description')} icon={History} actions={<Link to="/articles" className="mm-secondary flex items-center gap-2 px-3 py-2 text-xs font-semibold"><ArrowLeft size={15} /> {t('history.back')}</Link>} />
      <div className="glass-panel rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Clock size={24} /></div>
        <h2 className="mt-4 font-display text-lg font-bold text-foreground">{t('history.emptyTitle')}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t('history.emptyBody')}</p>
        <div className="mt-6 inline-flex">
          <Badge variant="default" size="md" className="gap-2">
            <LockKeyhole size={13} /> {t('history.appendOnly')}
          </Badge>
        </div>
      </div>
    </div>
  )
}

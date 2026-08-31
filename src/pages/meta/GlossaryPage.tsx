import React, { useEffect, useState } from 'react'
import { BookOpen, Compass, Search, RefreshCw, AlertCircle } from 'lucide-react'
import { getGlossary } from '../../api/search'
import { useLanguage } from '../../i18n/LanguageProvider'
import PageHeader from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'

export default function GlossaryPage() {
  const { t } = useLanguage()
  const [glossary, setGlossary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // A failed load previously rendered "No matching glossary terms found", which blames the
  // user's filter for a request that never returned.
  const [failed, setFailed] = useState(false)
  const [filterText, setFilterText] = useState('')

  const fetchGlossaryList = async () => {
    setLoading(true)
    try {
      const data = await getGlossary()
      setGlossary(data)
      setFailed(false)
    } catch (err) {
      console.error(err)
      setGlossary([])
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGlossaryList()
  }, [])

  const filteredGlossary = glossary.filter(item => 
    item.term.toLowerCase().includes(filterText.toLowerCase()) || 
    item.definition.toLowerCase().includes(filterText.toLowerCase())
  )

  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow="Shared language" title="Glossary terms" description="Definitions of standardized company acronyms and domain language." icon={Compass} actions={<div className="w-64">
          <Input
            type="text"
            placeholder={t('glossary.search')}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            leftIcon={<Search size={14} />}
            className="text-xs"
          />
        </div>} />

      {loading ? (
        <div className="flex justify-center items-center h-48 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500 mr-3" />
          <span>{t('glossary.loading')}</span>
        </div>
      ) : failed ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2.5 font-medium">
            <AlertCircle size={18} className="mt-px shrink-0" />
            {t('glossary.loadFailed')}
          </span>
          <Button variant="danger" size="sm" onClick={fetchGlossaryList} icon={<RefreshCw size={14} />}>{t('common.retry')}</Button>
        </div>
      ) : filteredGlossary.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center bg-slate-900/5 text-slate-500 text-xs">
          {t('glossary.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredGlossary.map((item, idx) => (
            <div
              key={idx}
              className="glass-panel interactive-lift rounded-2xl border border-border p-5 space-y-2.5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="md" className="uppercase font-extrabold">
                  {item.term}
                </Badge>
              </div>
              <p className="text-charcoal text-sm leading-relaxed leading-normal">
                {item.definition}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

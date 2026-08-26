import React, { useEffect, useState } from 'react'
import { BookOpen, Compass, Search, RefreshCw } from 'lucide-react'
import { getGlossary } from '../../api/search'
import PageHeader from '../../components/ui/PageHeader'

export default function GlossaryPage() {
  const [glossary, setGlossary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterText, setFilterText] = useState('')

  const fetchGlossaryList = async () => {
    setLoading(true)
    try {
      const data = await getGlossary()
      setGlossary(data)
    } catch (err) {
      console.error(err)
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
      <PageHeader eyebrow="Shared language" title="Glossary terms" description="Definitions of standardized company acronyms and domain language." icon={Compass} actions={<div className="relative w-64"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted"><Search size={14} /></span>
          <input
            type="text"
            placeholder="Search glossary..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="field pl-9 text-xs"
          />
        </div>} />

      {loading ? (
        <div className="flex justify-center items-center h-48 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500 mr-3" />
          <span>Syncing terms glossary...</span>
        </div>
      ) : filteredGlossary.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center bg-slate-900/5 text-slate-500 text-xs">
          No matching glossary terms found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredGlossary.map((item, idx) => (
            <div
              key={idx}
              className="glass-panel interactive-lift rounded-2xl border border-border p-5 space-y-2.5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="bg-brand-500/10 text-brand-400 border border-brand-500/10 px-3 py-1 rounded-lg text-xs font-extrabold uppercase">
                  {item.term}
                </span>
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

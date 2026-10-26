import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Copy, Download, Maximize2, MessageSquareText, Search } from 'lucide-react'
import type { EvidenceTable as EvidenceTableData } from '../../types/ai'
import { formatEvidenceRowSummary } from '../../lib/evidence-presentation'
import { filterRows, safeFileName, sortRows, tableToCsv, tableToTsv, type SortDirection } from '../../lib/evidence-table'
import { fetchEvidenceTable } from '../../api/articles'
import EvidenceDialog from './EvidenceDialog'

export interface EvidenceTableLabels {
  rowSummary: string
  filter: string
  copy: string
  copied: string
  csv: string
  expand: string
  close: string
  showAll: string
  loadingAll: string
  loadFailed: string
  noMatch: string
  sortBy: string
  ask: string
}

interface EvidenceTableProps {
  table: EvidenceTableData
  label: string
  labels: EvidenceTableLabels
  /** With both, a table that was cut short can fetch its remaining rows. */
  articleId?: string
  evidenceId?: string
  onAsk?: () => void
  /** Draws one cell. The row is the same object the table was given, however it is sorted or filtered. */
  renderCell?: (row: Array<string | number | null>, columnIndex: number, value: string | number | null) => React.ReactNode
}

/**
 * One table from a document, shown in the answer and usable there: click a header to sort,
 * type to filter, copy it to a spreadsheet, download it as CSV, open it large, fetch the
 * rows that were left out, or ask a question about it.
 *
 * Sorting and filtering are views over the rows; copy and CSV export what the reader is
 * looking at, so a filtered or sorted table is taken away as it is seen.
 */
export default function EvidenceTable({ table, label, labels, articleId, evidenceId, onAsk, renderCell }: EvidenceTableProps) {
  const [full, setFull] = useState<EvidenceTableData | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const shown = full ?? table
  const total = shown.total_rows ?? shown.rows.length
  const cut = total > shown.rows.length

  const loadAll = async () => {
    if (!articleId || !evidenceId) return
    setLoading(true)
    setFailed(false)
    try {
      const data = await fetchEvidenceTable(articleId, evidenceId)
      if (Array.isArray(data.columns) && Array.isArray(data.rows)) {
        setFull({ columns: data.columns, rows: data.rows, total_rows: data.rows.length, truncated: false })
      } else {
        setFailed(true)
      }
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const copy = async (view: EvidenceTableData) => {
    try {
      await navigator.clipboard.writeText(tableToTsv(view))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable (insecure context, denied): the CSV button still works */
    }
  }

  const download = (view: EvidenceTableData) => {
    const url = URL.createObjectURL(new Blob([tableToCsv(view)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = safeFileName(label, 'csv')
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const tool = 'inline-flex h-7 items-center gap-1 rounded-control border border-hairline bg-canvas px-2 text-caption font-semibold text-steel transition hover:border-info/40 hover:text-ink disabled:opacity-50'

  const toolbar = (view: EvidenceTableData, big: boolean) => (
    <>
      <button type="button" className={tool} onClick={() => void copy(view)}>{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? labels.copied : labels.copy}</button>
      <button type="button" className={tool} onClick={() => download(view)}><Download size={12} />{labels.csv}</button>
      {!big && <button type="button" className={tool} onClick={() => setExpanded(true)}><Maximize2 size={12} />{labels.expand}</button>}
      {onAsk && !big && <button type="button" className={tool} onClick={onAsk}><MessageSquareText size={12} />{labels.ask}</button>}
    </>
  )

  if (!table.columns.length || !table.rows.length) return null

  return (
    <div className="overflow-hidden rounded-xl border border-hairline">
      <Grid table={shown} label={label} labels={labels} maxHeight="max-h-80" toolbar={view => toolbar(view, false)} renderCell={renderCell} />
      {(cut || shown.truncated) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline bg-surface-muted px-3 py-2">
          <p className="text-caption text-stone">{formatEvidenceRowSummary(labels.rowSummary, shown.rows.length, total)}</p>
          {articleId && evidenceId && (
            <button type="button" className={tool} disabled={loading} onClick={() => void loadAll()}>{loading ? labels.loadingAll : labels.showAll}</button>
          )}
          {failed && <span role="alert" className="text-caption text-destructive-text">{labels.loadFailed}</span>}
        </div>
      )}
      {expanded && (
        <EvidenceDialog title={label} closeLabel={labels.close} onClose={() => setExpanded(false)}>
          <div className="p-4">
            <Grid table={shown} label={label} labels={labels} maxHeight="max-h-[65dvh]" toolbar={view => toolbar(view, true)} renderCell={renderCell} />
          </div>
        </EvidenceDialog>
      )}
    </div>
  )
}

function Grid({ table, label, labels, maxHeight, toolbar, renderCell }: {
  table: EvidenceTableData
  label: string
  labels: EvidenceTableLabels
  maxHeight: string
  toolbar: (view: EvidenceTableData) => React.ReactNode
  renderCell?: EvidenceTableProps['renderCell']
}) {
  const [sort, setSort] = useState<{ column: number; direction: SortDirection } | null>(null)
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const filtered = filterRows(table.rows, query)
    return sort ? sortRows(filtered, sort.column, sort.direction) : filtered
  }, [table.rows, query, sort])

  const toggle = (column: number) =>
    setSort(current => {
      if (!current || current.column !== column) return { column, direction: 'asc' }
      return current.direction === 'asc' ? { column, direction: 'desc' } : null
    })

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline bg-surface-muted px-2 py-1.5">
        <label className="relative min-w-32 flex-1 sm:max-w-56">
          <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-stone" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={labels.filter}
            aria-label={labels.filter}
            className="h-7 w-full rounded-control border border-hairline bg-canvas pl-7 pr-2 text-caption text-ink outline-none focus:border-info/50"
          />
        </label>
        {toolbar({ columns: table.columns, rows })}
      </div>
      <div className={`${maxHeight} overflow-auto`}>
        <table className="min-w-full border-collapse text-left text-xs" aria-label={label}>
          <thead className="sticky top-0 z-raised bg-surface-muted text-foreground">
            <tr>
              {table.columns.map((column, index) => {
                const active = sort?.column === index
                const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th key={`${column}-${index}`} scope="col" aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="whitespace-nowrap border-b border-hairline p-0 font-semibold">
                    <button type="button" onClick={() => toggle(index)} title={`${labels.sortBy} ${column}`} className="flex w-full items-center gap-1 px-3 py-2 text-left font-semibold hover:bg-surface-soft">
                      {column}
                      <Icon size={11} className={active ? 'text-info' : 'text-stone/60'} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-canvas">
                {table.columns.map((_, columnIndex) => <td key={columnIndex} className="max-w-64 border-b border-hairline/70 px-3 py-2 align-top text-steel">{renderCell ? renderCell(row, columnIndex, row[columnIndex] ?? null) : String(row[columnIndex] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-3 py-4 text-center text-caption text-stone">{labels.noMatch}</p>}
      </div>
    </div>
  )
}

import type { EvidenceTable as EvidenceTableData } from '../../types/ai'
import { formatEvidenceRowSummary } from '../../lib/evidence-presentation'

interface EvidenceTableProps {
  table: EvidenceTableData
  label: string
  rowSummaryTemplate: string
}

export default function EvidenceTable({ table, label, rowSummaryTemplate }: EvidenceTableProps) {
  if (!table.columns.length || !table.rows.length) return null

  return (
    <div className="overflow-hidden rounded-xl border border-hairline">
      <div className="max-h-80 overflow-auto">
        <table className="min-w-full border-collapse text-left text-xs" aria-label={label}>
          <thead className="sticky top-0 z-raised bg-surface-muted text-foreground">
            <tr>{table.columns.map((column, index) => <th key={`${column}-${index}`} scope="col" className="whitespace-nowrap border-b border-hairline px-3 py-2 font-semibold">{column}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-canvas">
                {table.columns.map((_, columnIndex) => <td key={columnIndex} className="max-w-64 border-b border-hairline/70 px-3 py-2 align-top text-steel">{String(row[columnIndex] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(table.truncated || (table.total_rows ?? table.rows.length) > table.rows.length) && (
        <p className="border-t border-hairline bg-surface-muted px-3 py-2 text-caption text-stone">{formatEvidenceRowSummary(rowSummaryTemplate, table.rows.length, table.total_rows ?? table.rows.length)}</p>
      )}
    </div>
  )
}

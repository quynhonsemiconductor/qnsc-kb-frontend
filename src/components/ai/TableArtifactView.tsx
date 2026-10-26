import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { TableArtifact } from '../../types/ai'
import EvidenceTable, { type EvidenceTableLabels } from './EvidenceTable'

interface TableArtifactViewProps {
  artifact: TableArtifact
  labels: EvidenceTableLabels
}

/**
 * A table the assistant built itself (statistics about the collection, a list of documents),
 * as opposed to one cut out of a document. It is the same interactive table -- sort, filter,
 * copy, CSV, expand -- and when the server names a document for each row, that column opens it.
 *
 * Rows are matched to their documents by identity, not by position: sorting and filtering
 * reorder the very same row objects, so a link follows its row wherever the reader moves it.
 */
export default function TableArtifactView({ artifact, labels }: TableArtifactViewProps) {
  const links = useMemo(() => {
    const byRow = new WeakMap<object, string>()
    if (artifact.link_column !== null && artifact.row_links) {
      artifact.rows.forEach((row, index) => {
        const id = artifact.row_links?.[index]?.article_id
        if (id) byRow.set(row, id)
      })
    }
    return byRow
  }, [artifact])

  const linkColumn = artifact.link_column
  return (
    <figure className="m-0" data-testid="table-artifact">
      <figcaption className="mb-1.5 text-caption font-semibold uppercase tracking-widest text-stone">{artifact.title}</figcaption>
      <EvidenceTable
        table={{ columns: artifact.columns, rows: artifact.rows, total_rows: artifact.total_rows, truncated: artifact.truncated }}
        label={artifact.title}
        labels={labels}
        renderCell={(row, columnIndex, value) => {
          const text = String(value ?? '—')
          const id = columnIndex === linkColumn ? links.get(row) : undefined
          return id ? <Link to={`/articles/${encodeURIComponent(id)}`} className="font-medium text-info hover:underline">{text}</Link> : text
        }}
      />
    </figure>
  )
}

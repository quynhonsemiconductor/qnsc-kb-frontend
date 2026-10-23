import { useCallback, useEffect, useRef, useState } from 'react'
import { CONTEXT_CHARS, cleanSelectedText, contextAround, type SelectionInfo } from '../../lib/selectionEdit'

/** A text file shown in the page, so its words can be selected like any other text. */
export default function PlainTextViewer({
  blob,
  onSelect,
}: {
  blob: Blob
  onSelect?: (selection: SelectionInfo | null) => void
}) {
  const [text, setText] = useState('')
  const host = useRef<HTMLPreElement>(null)

  useEffect(() => {
    let alive = true
    void blob.text().then(value => { if (alive) setText(value.replace(/^﻿/, '')) })
    return () => { alive = false }
  }, [blob])

  const report = useCallback(() => {
    const element = host.current
    const selection = window.getSelection()
    if (!element || !onSelect || !selection || selection.rangeCount === 0 || selection.isCollapsed) return onSelect?.(null)
    const range = selection.getRangeAt(0)
    if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return onSelect(null)
    const before = document.createRange()
    before.selectNodeContents(element)
    before.setEnd(range.startContainer, range.startOffset)
    const start = before.toString().length
    const selected = cleanSelectedText(range.toString())
    const around = contextAround(element.textContent || '', start, range.toString().length, CONTEXT_CHARS)
    const box = range.getBoundingClientRect()
    onSelect({ text: selected, before: around.before, after: around.after, rect: { left: box.left, top: box.top, width: box.width, height: box.height } })
  }, [onSelect])

  return (
    <pre
      ref={host}
      onMouseUp={() => window.setTimeout(report, 0)}
      onKeyUp={() => window.setTimeout(report, 0)}
      className="h-full overflow-auto whitespace-pre-wrap break-words bg-white p-4 text-sm leading-6 text-foreground"
    >
      {text}
    </pre>
  )
}

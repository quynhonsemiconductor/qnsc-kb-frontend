import { useMemo, useState, useCallback } from 'react'

interface UsePaginationOptions {
  totalItems: number
  pageSize?: number
  initialPage?: number
}

export function usePagination({ totalItems, pageSize = 20, initialPage = 1 }: UsePaginationOptions) {
  const [currentPage, setCurrentPage] = useState(initialPage)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalItems / pageSize)), [totalItems, pageSize])

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }, [totalPages])

  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage])
  const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage])

  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  const pageRange = useMemo(() => {
    const delta = 2
    const range: number[] = []
    const rangeStart = Math.max(2, currentPage - delta)
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta)

    if (totalPages <= 1) return [1]
    range.push(1)
    if (rangeStart > 2) range.push(-1) // ellipsis
    for (let i = rangeStart; i <= rangeEnd; i++) range.push(i)
    if (rangeEnd < totalPages - 1) range.push(-1) // ellipsis
    if (totalPages > 1) range.push(totalPages)
    return range
  }, [currentPage, totalPages])

  return {
    currentPage,
    totalPages,
    pageSize,
    startIndex,
    endIndex,
    pageRange,
    goToPage,
    nextPage,
    prevPage,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages,
  }
}

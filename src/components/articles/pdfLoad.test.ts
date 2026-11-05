import { describe, expect, it, vi } from 'vitest'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { startPdfLoad, type PdfModule } from './pdfLoad'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Test double only: the app path uses the real imported pdfjs module. */
function pdfModule(getDocument: (...args: never[]) => PDFDocumentLoadingTask): PdfModule {
  return { getDocument } as unknown as PdfModule
}

function fakeTask(promise: Promise<PDFDocumentProxy>) {
  return {
    promise,
    destroy: vi.fn(() => Promise.resolve()),
  } as unknown as PDFDocumentLoadingTask & { destroy: ReturnType<typeof vi.fn> }
}

const blob = () => new Blob([new Uint8Array([1, 2, 3])])

describe('startPdfLoad', () => {
  it('does not call getDocument when cancelled before the module resolves', async () => {
    const module = deferred<PdfModule>()
    const getDocument = vi.fn(() => fakeTask(Promise.resolve({} as PDFDocumentProxy)))
    const load = startPdfLoad(() => module.promise, blob(), {
      onDocument: vi.fn(),
      onError: vi.fn(),
    })

    load.cancel()
    module.resolve(pdfModule(getDocument))
    await Promise.resolve()
    await Promise.resolve()

    expect(getDocument).not.toHaveBeenCalled()
  })

  it('cancel during the pending document promise destroys the task and never calls onDocument', async () => {
    const document = deferred<PDFDocumentProxy>()
    const task = fakeTask(document.promise)
    const getDocument = vi.fn(() => task)
    const onDocument = vi.fn()
    const load = startPdfLoad(async () => pdfModule(getDocument), blob(), {
      onDocument,
      onError: vi.fn(),
    })

    await vi.waitFor(() => expect(getDocument).toHaveBeenCalledOnce())
    load.cancel()
    document.resolve({} as PDFDocumentProxy)
    await Promise.resolve()
    await Promise.resolve()

    expect(task.destroy).toHaveBeenCalledOnce()
    expect(onDocument).not.toHaveBeenCalled()
  })

  it('cancelling while arrayBuffer is pending never starts getDocument', async () => {
    const buffer = deferred<ArrayBuffer>()
    const unreadable = { arrayBuffer: () => buffer.promise } as unknown as Blob
    const getDocument = vi.fn()
    const onDocument = vi.fn()
    const onError = vi.fn()
    const load = startPdfLoad(async () => pdfModule(getDocument), unreadable, {
      onDocument,
      onError,
    })

    await Promise.resolve()
    load.cancel()
    buffer.resolve(new ArrayBuffer(3))
    await Promise.resolve()
    await Promise.resolve()

    expect(getDocument).not.toHaveBeenCalled()
    expect(onDocument).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('destroys the loading task when the document promise rejects after unmount', async () => {
    const document = deferred<PDFDocumentProxy>()
    const task = fakeTask(document.promise)
    const getDocument = vi.fn(() => task)
    const onError = vi.fn()
    const load = startPdfLoad(async () => pdfModule(getDocument), blob(), {
      onDocument: vi.fn(),
      onError,
    })

    await vi.waitFor(() => expect(getDocument).toHaveBeenCalledOnce())
    load.cancel()
    document.reject(new Error('load failed after unmount'))
    await Promise.resolve()
    await Promise.resolve()

    expect(task.destroy).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports a failed module import once, without a task to destroy', async () => {
    const onError = vi.fn()
    startPdfLoad(() => Promise.reject(new Error('chunk load failed')), blob(), {
      onDocument: vi.fn(),
      onError,
    })

    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce())
  })

  it('reports an unreadable blob once, before any task exists', async () => {
    const onError = vi.fn()
    const unreadable = {
      arrayBuffer: () => Promise.reject(new Error('blob read failed')),
    } as unknown as Blob
    const getDocument = vi.fn()
    startPdfLoad(async () => pdfModule(getDocument), unreadable, {
      onDocument: vi.fn(),
      onError,
    })

    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce())
    expect(getDocument).not.toHaveBeenCalled()
  })

  it('reports an error and does not destroy when the load rejects while mounted', async () => {
    const document = deferred<PDFDocumentProxy>()
    const task = fakeTask(document.promise)
    const onError = vi.fn()
    startPdfLoad(async () => pdfModule(vi.fn(() => task)), blob(), {
      onDocument: vi.fn(),
      onError,
    })

    await vi.waitFor(() => expect(task.promise).toBeDefined())
    document.reject(new Error('load failed'))
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce())

    expect(task.destroy).not.toHaveBeenCalled()
  })
})

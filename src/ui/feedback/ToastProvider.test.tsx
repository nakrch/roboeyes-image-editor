import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ToastViewport, type ToastNotice } from './ToastProvider'

function renderNotice(notice: ToastNotice | null): string {
  return renderToStaticMarkup(<ToastViewport notice={notice} onDismiss={vi.fn()} />)
}

describe('ToastViewport', () => {
  it('renders non-error action feedback as a polite status', () => {
    const html = renderNotice({ id: 1, tone: 'success', message: 'Downloading PNG…' })

    expect(html).toContain('toast-success')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Downloading PNG…')
  })

  it('renders failures as assertive alerts', () => {
    const html = renderNotice({ id: 2, tone: 'error', message: 'Export failed' })

    expect(html).toContain('toast-error')
    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-live="assertive"')
    expect(html).toContain('Export failed')
  })

  it('renders nothing when there is no active notification', () => {
    expect(renderNotice(null)).toBe('')
  })
})

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import './toast.css'

export type ToastTone = 'success' | 'error'

export type ToastNotice = {
  id: number
  tone: ToastTone
  message: string
}

type ToastContextValue = {
  notify: (tone: ToastTone, message: string) => void
}

type ToastProviderProps = {
  children: ReactNode
  durationMs?: number
}

type ToastViewportProps = {
  notice: ToastNotice | null
  onDismiss: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastViewport({ notice, onDismiss }: ToastViewportProps) {
  if (notice === null) return null

  return (
    <div className="toast-viewport">
      <div
        className={`toast toast-${notice.tone}`}
        role={notice.tone === 'error' ? 'alert' : 'status'}
        aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
      >
        <span className="toast-indicator" aria-hidden="true">
          {notice.tone === 'error' ? '!' : '✓'}
        </span>
        <span className="toast-message">{notice.message}</span>
        <button className="toast-dismiss" type="button" onClick={onDismiss} aria-label="Dismiss notification">
          ×
        </button>
      </div>
    </div>
  )
}

export function ToastProvider({ children, durationMs = 3200 }: ToastProviderProps) {
  const [notice, setNotice] = useState<ToastNotice | null>(null)
  const nextId = useRef(0)

  const notify = useCallback((tone: ToastTone, message: string) => {
    nextId.current += 1
    setNotice({ id: nextId.current, tone, message })
  }, [])

  const dismiss = useCallback(() => setNotice(null), [])

  useEffect(() => {
    if (notice === null) return
    const timeout = window.setTimeout(() => {
      setNotice((current) => current?.id === notice.id ? null : current)
    }, durationMs)
    return () => window.clearTimeout(timeout)
  }, [durationMs, notice])

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <ToastViewport notice={notice} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === null) throw new Error('useToast must be used within ToastProvider')
  return context
}

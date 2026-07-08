import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

const ICONS = {
  success: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>
  ),
}

const STYLES = {
  success: 'bg-white border-green-500  text-green-700  [&_.icon]:bg-green-100  [&_.icon]:text-green-600',
  error:   'bg-white border-red-500    text-red-700    [&_.icon]:bg-red-100    [&_.icon]:text-red-600',
  info:    'bg-white border-blue-500   text-blue-700   [&_.icon]:bg-blue-100   [&_.icon]:text-blue-600',
  warning: 'bg-white border-amber-500  text-amber-700  [&_.icon]:bg-amber-100  [&_.icon]:text-amber-600',
}

function ToastItem({ toast, dismiss }) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-2xl border-l-4 shadow-lg min-w-[280px] max-w-xs animate-slide-in ${STYLES[toast.type] || STYLES.info}`}
    >
      <span className="icon w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
        {ICONS[toast.type] || ICONS.info}
      </span>
      <p className="flex-1 text-sm font-semibold leading-snug pt-0.5">{toast.message}</p>
      <button
        onClick={() => dismiss(toast.id)}
        className="text-slate-400 hover:text-slate-700 flex-shrink-0 mt-0.5 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} dismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

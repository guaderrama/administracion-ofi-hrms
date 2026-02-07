import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  exiting?: boolean;
}

interface ToastContextType {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const ICONS: Record<string, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5 text-success-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-error-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-warning-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-info-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const BG_STYLES: Record<string, string> = {
  success: 'bg-success-light border-success',
  error: 'bg-error-light border-error',
  warning: 'bg-warning-light border-warning',
  info: 'bg-info-light border-info',
};

const SingleToast: React.FC<{ toast: ToastItem; onClose: (id: string) => void }> = ({ toast, onClose }) => (
  <div
    role="alert"
    aria-live="polite"
    className={`flex items-start gap-3 px-4 py-3 rounded-card border shadow-card max-w-sm w-full ${BG_STYLES[toast.type]} ${toast.exiting ? 'animate-toast-out' : 'animate-toast-in'}`}
  >
    <div className="flex-shrink-0 mt-0.5">{ICONS[toast.type]}</div>
    <div className="flex-1 min-w-0">
      {toast.title && <p className="text-sm font-semibold text-slate-800">{toast.title}</p>}
      <p className="text-sm text-slate-700">{toast.message}</p>
    </div>
    <button
      onClick={() => onClose(toast.id)}
      className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
      aria-label="Cerrar notificacion"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  const addToast = useCallback((type: ToastItem['type'], message: string, title?: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const duration = type === 'error' ? 6000 : 4000;
    setToasts(prev => [...prev.slice(-4), { id, type, message, title, duration }]);
    const timer = window.setTimeout(() => removeToast(id), duration);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  useEffect(() => {
    return () => { timersRef.current.forEach(t => clearTimeout(t)); };
  }, []);

  const ctx: ToastContextType = {
    success: (msg, title) => addToast('success', msg, title),
    error: (msg, title) => addToast('error', msg, title),
    warning: (msg, title) => addToast('warning', msg, title),
    info: (msg, title) => addToast('info', msg, title),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" aria-label="Notificaciones">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <SingleToast toast={t} onClose={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

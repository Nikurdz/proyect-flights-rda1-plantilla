import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react';
import { ToastContext, type ToastApi, type ToastOptions, type ToastTone } from '../../lib/toast';

interface ToastItem extends ToastOptions {
  id: string;
  tone: ToastTone;
}

const TONES: Record<ToastTone, { Icon: LucideIcon; icon: string; label: string }> = {
  success: { Icon: CheckCircle2, icon: 'text-success', label: 'Listo' },
  error: { Icon: XCircle, icon: 'text-danger', label: 'Error' },
  warning: { Icon: AlertTriangle, icon: 'text-warning', label: 'Aviso' },
  info: { Icon: Info, icon: 'text-gold-text', label: 'Información' },
};

const ToastCard: React.FC<{ toast: ToastItem; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  const { Icon, icon, label } = TONES[toast.tone];
  const duration = toast.duration ?? (toast.tone === 'error' ? 8000 : 5000);
  const [paused, setPaused] = useState(false);

  // Auto-hide; the timer stops while the pointer or the keyboard focus is on the toast.
  useEffect(() => {
    if (!duration || paused) return;
    const timer = window.setTimeout(() => onClose(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [duration, paused, onClose, toast.id]);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- pointer/focus only pause the auto-hide timer; the close button is the keyboard path
    <div
      className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-3.5 text-ink shadow-elevated motion-safe:animate-in motion-safe:fade-in"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          <span className="sr-only">{label}: </span>
          {toast.title}
        </p>
        {toast.description && <p className="mt-0.5 text-sm text-muted">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        aria-label="Cerrar aviso"
        className="-m-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-ink/5 hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

/**
 * Hosts the toasts. Two always-present live regions: `polite` (success, info, warning) and
 * `assertive` (errors), so assistive technology announces each new message. Mount once near the root.
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => setToasts((current) => current.filter((t) => t.id !== id)), []);

  const show = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    const tone = options.tone ?? 'info';
    // At most 4 visible: the oldest goes first.
    setToasts((current) => [...current, { ...options, id, tone }].slice(-4));
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, description) => show({ title, description, tone: 'success' }),
      error: (title, description) => show({ title, description, tone: 'error' }),
      info: (title, description) => show({ title, description, tone: 'info' }),
      warning: (title, description) => show({ title, description, tone: 'warning' }),
    }),
    [show, dismiss]
  );

  const polite = toasts.filter((t) => t.tone !== 'error');
  const assertive = toasts.filter((t) => t.tone === 'error');

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96 sm:items-stretch print:hidden">
        <div role="status" aria-live="polite" aria-atomic="false" className="flex w-full flex-col gap-2">
          {polite.map((t) => (
            <ToastCard key={t.id} toast={t} onClose={dismiss} />
          ))}
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="false" className="flex w-full flex-col gap-2">
          {assertive.map((t) => (
            <ToastCard key={t.id} toast={t} onClose={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};

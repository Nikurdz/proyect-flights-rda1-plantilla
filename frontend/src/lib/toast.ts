import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  /** Short sentence saying what happened ("Vuelo cancelado"). */
  title: string;
  /** Optional second line (what to do next). */
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before it hides itself. 0 keeps it until it is closed. Default: 5000 (8000 for errors). */
  duration?: number;
}

export interface ToastApi {
  show: (options: ToastOptions) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
}

const noop = () => '';

/** Outside a ToastProvider the calls do nothing (components still render in isolated tests). */
export const ToastContext = createContext<ToastApi>({
  show: noop,
  success: noop,
  error: noop,
  info: noop,
  warning: noop,
  dismiss: () => undefined,
});

export const useToast = (): ToastApi => useContext(ToastContext);

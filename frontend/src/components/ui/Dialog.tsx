import React, { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: string;
  /** Contenido pequeño sobre el título (p. ej. número de vuelo). */
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '5xl';
  /** `dark` usa la cabecera de marca (negro RAM). */
  variant?: 'light' | 'dark';
  /**
   * `false` para una decisión obligatoria: sin botón de cerrar, y Escape y el clic en el fondo no
   * hacen nada. El contenido debe explicar qué opción elegir.
   */
  dismissible?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const maxWidths = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '5xl': 'max-w-5xl',
};

/**
 * Modal accesible: foco inicial al abrir, trampa de foco (Tab circular), Escape cierra,
 * el foco vuelve al disparador al cerrar y el overlay solo cierra con clic directo.
 */
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  eyebrow,
  children,
  maxWidth = 'md',
  variant = 'light',
  dismissible = true,
}) => {
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-description`;
  const panelRef = useRef<HTMLDivElement>(null);
  // The latest onClose, read by the listeners without re-running the open/close effect on every render.
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });
  const requestClose = () => {
    if (dismissibleRef.current) onCloseRef.current();
  };

  useEffect(() => {
    if (!isOpen) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    // Foco inicial: primer control del contenido; si no hay, el propio panel (tabIndex -1).
    const content = panel?.querySelector<HTMLElement>('[data-dialog-content]');
    const firstInContent = content?.querySelector<HTMLElement>(FOCUSABLE);
    (firstInContent ?? panel)?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (dismissibleRef.current) onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (trigger && document.contains(trigger)) trigger.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const dark = variant === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      {/* Backdrop: a pointer convenience only (keyboard users have Escape and the close button). */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-hidden="true"
        onMouseDown={requestClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={clsx(
          'relative z-10 flex w-full max-h-[85vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl focus:outline-none',
          maxWidths[maxWidth]
        )}
      >
        <div
          className={clsx(
            'flex shrink-0 items-start justify-between gap-3 px-6 py-4',
            dark ? 'bg-brand-black text-white' : 'border-b border-slate-100'
          )}
        >
          <div>
            {eyebrow && <div className="mb-1">{eyebrow}</div>}
            <h2 id={titleId} className={clsx('text-lg font-bold', dark ? 'text-white' : 'text-airline-navy')}>
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
          <button
            type="button"
            onClick={requestClose}
            className={clsx(
              'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors',
              dark
                ? 'text-white/70 hover:bg-white/10 hover:text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-600'
            )}
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
          )}
        </div>
        <div data-dialog-content className="overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
};

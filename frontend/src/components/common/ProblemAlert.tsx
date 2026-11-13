import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, WifiOff } from 'lucide-react';
import { ProblemDetailsError } from '../../api/problem-details';
import { NETWORK_MESSAGE, isNetworkError } from '../../lib/network-error';

export interface ProblemAlertProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  title?: string;
  /** Texto propio para un contexto concreto (reemplaza el mensaje genérico del código). */
  message?: string;
}

const GENERIC = 'No pudimos completar la operación. Intenta de nuevo en unos segundos.';

export const ProblemAlert: React.FC<ProblemAlertProps> = ({ error, onRetry, className = '', title, message: messageOverride }) => {
  const [copied, setCopied] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const hasError = Boolean(error);

  // Move the focus to the alert when an error appears, so it is read and the next Tab reaches "Reintentar".
  useEffect(() => {
    if (hasError) alertRef.current?.focus();
  }, [hasError, error]);

  if (!error) return null;

  // Only messages we wrote reach the screen: a raw Error (network, parsing) is never shown as is.
  const isProblem = error instanceof ProblemDetailsError;
  const network = isNetworkError(error);
  const message = network ? NETWORK_MESSAGE : isProblem ? messageOverride ?? error.message : GENERIC;
  const fields = isProblem ? error.invalidParams : [];
  const supportCode = isProblem && error.correlationId ? `${error.code}·${error.correlationId}` : undefined;
  const heading = title ?? (network ? 'Sin conexión con el servidor' : 'No pudimos completar la acción');
  const Icon = network ? WifiOff : AlertCircle;

  const copySupportCode = async () => {
    if (!supportCode) return;
    try {
      await navigator.clipboard.writeText(supportCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div ref={alertRef} tabIndex={-1} className={`rounded-xl border border-danger/40 bg-danger-soft p-4 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-text ${className}`} role="alert" aria-live="assertive">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-danger">{heading}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{message}</p>

          {fields.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-1 text-small text-ink">
              {fields.map((field, index) => (
                <li key={`${field.name}-${index}`}>
                  <strong>{field.label}:</strong> {field.reason}
                </li>
              ))}
            </ul>
          )}

          {(onRetry || supportCode) && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {onRetry && (
                <button type="button" onClick={onRetry} className="inline-flex min-h-[44px] items-center px-1 text-small font-semibold text-danger underline hover:text-ink">
                  Reintentar
                </button>
              )}
              {supportCode && (
                <>
                  <button type="button" onClick={copySupportCode} className="inline-flex min-h-[44px] items-center px-1 text-small text-danger underline hover:text-ink">
                    {copied ? 'Código copiado' : 'Copiar código para soporte'}
                  </button>
                  <span className="text-xs text-muted">
                    Código para soporte: <code className="num select-all break-all">{supportCode}</code>
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ProblemDetailsError } from '../../api/problem-details';

export interface ProblemAlertProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  title?: string;
  /** Texto propio para un contexto concreto (reemplaza el mensaje genérico del código). */
  message?: string;
}

const GENERIC = 'No pudimos completar la operación. Intenta de nuevo en unos segundos.';

export const ProblemAlert: React.FC<ProblemAlertProps> = ({ error, onRetry, className = '', title = 'No pudimos completar la acción', message: messageOverride }) => {
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
  const message = isProblem ? messageOverride ?? error.message : GENERIC;
  const fields = isProblem ? error.invalidParams : [];
  const supportCode = isProblem && error.correlationId ? `${error.code}·${error.correlationId}` : undefined;

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
    <div ref={alertRef} tabIndex={-1} className={`rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${className}`} role="alert" aria-live="assertive">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-bold text-red-800"><strong>{title}</strong></p>
          <p className="mt-1 text-sm leading-relaxed text-red-700">{message}</p>

          {fields.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-700">
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
                <button type="button" onClick={onRetry} className="inline-flex min-h-[44px] items-center px-1 text-xs font-semibold text-red-700 underline hover:text-red-900">
                  Reintentar
                </button>
              )}
              {supportCode && (
                <button type="button" onClick={copySupportCode} className="inline-flex min-h-[44px] items-center px-1 text-xs text-red-700 underline hover:text-red-900">
                  {copied ? 'Código copiado' : 'Copiar código para soporte'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { clsx } from 'clsx';
import { AlertCircle, ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Obligatoria: cada campo necesita una etiqueta programática. */
  label: string;
  hideLabel?: boolean;
  error?: string;
  helperText?: string;
  options?: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, hideLabel, error, helperText, options, children, id, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    return (
      <div className="w-full">
        <label htmlFor={selectId} className={clsx(hideLabel ? 'sr-only' : 'mb-1.5 block text-sm font-medium text-ink')}>
          {label}
        </label>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={clsx(
              'w-full appearance-none rounded-lg border bg-surface px-3.5 py-2.5 pr-10 text-body text-ink transition-colors focus-visible:border-gold-text disabled:cursor-not-allowed disabled:bg-ink/5 disabled:text-muted',
              error ? 'border-danger focus-visible:border-danger' : 'border-line-strong hover:border-ink/50',
              className
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
        {error && (
          <p id={`${selectId}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${selectId}-helper`} className="mt-1.5 text-sm text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

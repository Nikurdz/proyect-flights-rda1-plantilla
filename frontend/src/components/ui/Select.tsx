import React from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

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
        <label
          htmlFor={selectId}
          className={clsx(
            hideLabel ? 'sr-only' : 'block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1'
          )}
        >
          {label}
        </label>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={clsx(
              'w-full appearance-none rounded-lg border bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-airline-blue focus-visible:border-airline-blue disabled:bg-slate-50 disabled:text-slate-500',
              error
                ? 'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500'
                : 'border-slate-300 hover:border-slate-400',
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
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" aria-hidden="true">
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
        {error && (
          <p id={`${selectId}-error`} className="mt-1 text-xs text-red-600 font-medium" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${selectId}-helper`} className="mt-1 text-xs text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

import React from 'react';
import { clsx } from 'clsx';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Obligatoria: cada campo necesita una etiqueta programática. */
  label: string;
  /** Oculta la etiqueta visualmente pero la conserva para lectores de pantalla. */
  hideLabel?: boolean;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hideLabel, error, helperText, leftIcon, rightIcon, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full">
        <label htmlFor={inputId} className={clsx(hideLabel ? 'sr-only' : 'mb-1.5 block text-sm font-medium text-ink')}>
          {label}
        </label>
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 text-muted" aria-hidden="true">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full rounded-lg border bg-surface px-3.5 py-2.5 text-body text-ink transition-colors placeholder:text-muted focus-visible:border-gold-text disabled:cursor-not-allowed disabled:bg-ink/5 disabled:text-muted',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error ? 'border-danger focus-visible:border-danger' : 'border-line-strong hover:border-ink/50',
              className
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          {rightIcon && <div className="pointer-events-none absolute right-3 text-muted">{rightIcon}</div>}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="mt-1.5 text-sm text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

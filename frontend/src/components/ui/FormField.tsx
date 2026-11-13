import React from 'react';
import { clsx } from 'clsx';
import { AlertCircle } from 'lucide-react';

export const FieldLabel: React.FC<{ htmlFor: string; children: React.ReactNode; className?: string }> = ({
  htmlFor,
  children,
  className = 'mb-1.5 block text-sm font-medium text-ink',
}) => (
  <label htmlFor={htmlFor} className={className}>
    {children}
  </label>
);

/** Mensaje de error asociado al control con `fieldA11y(id, error)`. */
export const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
  message ? (
    <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  ) : null;

export interface FormFieldControlProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
  'aria-required': true | undefined;
}

export interface FormFieldProps {
  label: string;
  /** Id of the control; generated when omitted. */
  id?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** Renders the control, which must receive the accessibility attributes given here. */
  children: (control: FormFieldControlProps) => React.ReactNode;
}

/**
 * Label + control + hint + error, wired together (`aria-describedby`, `aria-invalid`).
 * <FormField label="Correo" error={e}>{(c) => <input {...c} className="…" />}</FormField>
 */
export const FormField: React.FC<FormFieldProps> = ({ label, id, hint, error, required, className, children }) => {
  const generated = React.useId();
  const fieldId = id ?? generated;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className={clsx('w-full', className)}>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </FieldLabel>
      {children({ id: fieldId, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy, 'aria-required': required ? true : undefined })}
      {!error && hint && (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      <FieldError id={fieldId} message={error} />
    </div>
  );
};

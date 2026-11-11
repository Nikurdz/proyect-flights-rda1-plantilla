import React from 'react';

export const FieldLabel: React.FC<{ htmlFor: string; children: React.ReactNode; className?: string }> = ({
  htmlFor,
  children,
  className = 'block text-xs font-bold text-slate-700 mb-1',
}) => (
  <label htmlFor={htmlFor} className={className}>
    {children}
  </label>
);

/** Mensaje de error asociado al control con `fieldA11y(id, error)`. */
export const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
  message ? (
    <p id={`${id}-error`} className="mt-1 text-[11px] font-medium text-red-600" role="alert">
      {message}
    </p>
  ) : null;

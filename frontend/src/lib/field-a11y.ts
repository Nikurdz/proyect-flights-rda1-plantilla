/** Atributos de accesibilidad de un control: id, aria-invalid y aria-describedby hacia el error (`FieldError`). */
export const fieldA11y = (id: string, error?: string) => ({
  id,
  'aria-invalid': Boolean(error),
  'aria-describedby': error ? `${id}-error` : undefined,
});

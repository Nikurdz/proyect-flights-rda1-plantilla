import React from 'react';
import { clsx } from 'clsx';
import { Input, type InputProps } from './Input';
import { filterSuggestions, normalizeText, type Suggestion } from '../../lib/suggestions';

export interface SuggestInputProps extends InputProps {
  suggestions: readonly Suggestion[];
  /** Máximo de opciones visibles (por defecto 8). */
  maxSuggestions?: number;
  /** Se llama al elegir una opción de la lista (además del cambio normal del campo). */
  onSuggestionSelect?: (suggestion: Suggestion) => void;
}

/** Cambia el valor de un input como si se hubiera escrito, para que React Hook Form y los campos controlados se enteren. */
function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Campo de texto con sugerencias en vivo (combobox ARIA). El valor es libre: la lista solo ayuda.
 * Funciona controlado (`value`/`onChange`) o registrado con React Hook Form.
 */
export const SuggestInput = React.forwardRef<HTMLInputElement, SuggestInputProps>(
  ({ suggestions, maxSuggestions = 8, onSuggestionSelect, onChange, onBlur, onKeyDown, onFocus, value, defaultValue, id, ...props }, forwardedRef) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const listId = `${inputId}-listbox`;
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const [typed, setTyped] = React.useState(String(defaultValue ?? ''));
    const [open, setOpen] = React.useState(false);
    const [active, setActive] = React.useState(-1);

    const text = value !== undefined ? String(value) : typed;
    const options = React.useMemo(() => {
      const filtered = filterSuggestions(suggestions, text, maxSuggestions);
      // Si lo escrito ya es exactamente la única opción, no hay nada que sugerir.
      if (filtered.length === 1 && normalizeText(filtered[0].value) === normalizeText(text) && text !== '') return [];
      return filtered;
    }, [suggestions, text, maxSuggestions]);
    const visible = open && options.length > 0;

    const setRefs = (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    const choose = (s: Suggestion) => {
      if (innerRef.current) setNativeValue(innerRef.current, s.value);
      setTyped(s.value);
      setOpen(false);
      setActive(-1);
      onSuggestionSelect?.(s);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!visible) {
          setOpen(true);
          setActive(0);
        } else setActive((i) => (i + 1) % options.length);
      } else if (e.key === 'ArrowUp' && visible) {
        e.preventDefault();
        setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
      } else if (e.key === 'Enter' && visible && active >= 0) {
        e.preventDefault(); // elegir no debe enviar el formulario
        choose(options[active]);
      } else if (e.key === 'Escape' && visible) {
        e.preventDefault();
        e.stopPropagation(); // cierra la lista, no el diálogo que la contiene
        setOpen(false);
        setActive(-1);
      }
    };

    return (
      <div className="relative w-full">
        <Input
          {...props}
          id={inputId}
          ref={setRefs}
          value={value}
          defaultValue={defaultValue}
          role="combobox"
          aria-expanded={visible}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={visible && active >= 0 ? `${inputId}-opt-${active}` : undefined}
          autoComplete="off"
          onChange={(e) => {
            setTyped(e.target.value);
            setOpen(true);
            setActive(-1);
            onChange?.(e);
          }}
          onFocus={(e) => {
            setOpen(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setOpen(false);
            setActive(-1);
            onBlur?.(e);
          }}
          onKeyDown={handleKeyDown}
        />
        {visible && (
          <ul
            id={listId}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- patrón combobox ARIA: lista de opciones
            role="listbox"
            aria-label={`Sugerencias: ${props.label}`}
            className="absolute left-0 z-30 mt-1 max-h-60 w-max min-w-full max-w-[min(22rem,80vw)] overflow-y-auto rounded-lg border border-line-strong bg-surface py-1 shadow-lg"
          >
            {options.map((s, i) => (
              <li
                key={s.value}
                id={`${inputId}-opt-${i}`}
                // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- patrón combobox ARIA
                role="option"
                aria-selected={i === active}
                // mousedown (no click) para que el campo no pierda el foco antes de elegir.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={clsx('flex cursor-pointer items-baseline justify-between gap-3 px-3.5 py-2 text-sm text-ink', i === active && 'bg-ink/5')}
              >
                <span className="truncate font-medium">{s.label ?? s.value}</span>
                {s.hint && <span className="shrink-0 text-xs text-muted">{s.hint}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);

SuggestInput.displayName = 'SuggestInput';

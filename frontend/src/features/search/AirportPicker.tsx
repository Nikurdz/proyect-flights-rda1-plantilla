import React, { useEffect, useId, useRef, useState } from 'react';
import { MapPin, PlaneTakeoff, PlaneLanding, X, Loader2 } from 'lucide-react';
import { useLocalidades } from '../../api/endpoints/catalog';
import type { LocalidadViewDto } from '../../api/types';

export interface AirportPickerProps {
  label: string;
  placeholder: string;
  value?: string; // IATA code
  onChange: (value: string, location?: LocalidadViewDto) => void;
  type: 'origin' | 'destination';
  error?: string;
}

/**
 * Combobox ARIA (patrón "list autocomplete"): el input conserva el foco y las opciones se navegan
 * con aria-activedescendant. Flechas mueven, Enter elige, Escape cierra, Tab cierra sin elegir.
 */
export const AirportPicker: React.FC<AirportPickerProps> = ({
  label,
  placeholder,
  value,
  onChange,
  type,
  error,
}) => {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const errorId = `${uid}-error`;
  const optionId = (index: number) => `${uid}-opt-${index}`;

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: localidades, isLoading, isError, refetch } = useLocalidades(query);
  const options = localidades ?? [];

  const cityOfValue = value
    ? localidades?.find((l) => l.iata === value)?.ciudad ?? (selectedCity || '')
    : '';
  const displayValue = editing ? query : value ? `${value}${cityOfValue ? ` · ${cityOfValue}` : ''}` : '';

  // Keep the active option inside range when the results change.
  useEffect(() => {
    setActiveIndex((current) => (current >= options.length ? options.length - 1 : current));
  }, [options.length]);

  // Keep the active option visible while navigating with the arrows.
  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const close = () => {
    setIsOpen(false);
    setEditing(false);
    setQuery('');
    setActiveIndex(-1);
  };

  const handleSelect = (loc: LocalidadViewDto) => {
    setSelectedCity(loc.ciudad);
    onChange(loc.iata, loc);
    close();
  };

  const handleClear = () => {
    onChange('');
    setSelectedCity('');
    setQuery('');
    setEditing(true);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setEditing(true);
          setIsOpen(true);
          setActiveIndex(options.length ? 0 : -1);
        } else if (options.length) {
          setActiveIndex((i) => (i + 1) % options.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setEditing(true);
          setIsOpen(true);
          setActiveIndex(options.length ? options.length - 1 : -1);
        } else if (options.length) {
          setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
        }
        break;
      case 'Home':
        if (isOpen && options.length) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (isOpen && options.length) {
          e.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      case 'Enter':
        if (isOpen) {
          // Never submit the search form while the list is open.
          e.preventDefault();
          if (activeIndex >= 0 && options[activeIndex]) handleSelect(options[activeIndex]);
        }
        break;
      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case 'Tab':
        close();
        break;
      default:
        break;
    }
  };

  const Icon = type === 'origin' ? PlaneTakeoff : PlaneLanding;
  const hasActive = isOpen && activeIndex >= 0 && activeIndex < options.length;

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
        {label}
      </label>

      <div
        className={`flex items-center w-full h-[54px] px-3.5 rounded-xl border bg-white transition-all ${
          isOpen
            ? 'border-airline-blue ring-2 ring-airline-blue/20 shadow-sm'
            : error
            ? 'border-red-400 bg-red-50/20'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <Icon className="w-5 h-5 text-airline-navy shrink-0 mr-3" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-activedescendant={hasActive ? optionId(activeIndex) : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={displayValue}
          placeholder={placeholder}
          onFocus={() => {
            setEditing(true);
            setQuery('');
            setIsOpen(true);
          }}
          onClick={() => {
            setEditing(true);
            setIsOpen(true);
          }}
          onChange={(e) => {
            setEditing(true);
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-500 focus:outline-none"
        />
        {isLoading && isOpen && <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" aria-hidden="true" />}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 p-1 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label={`Borrar ${label.toLowerCase()}`}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-600 font-medium" role="alert">
          {error}
        </p>
      )}

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in-50 zoom-in-95">
          <ul
            id={listId}
            role="listbox"
            aria-label={`Aeropuertos para ${label.toLowerCase()}`}
            className="max-h-64 overflow-y-auto divide-y divide-slate-100"
          >
            {options.map((loc, index) => (
              <li
                key={loc.iata}
                id={optionId(index)}
                role="option"
                aria-selected={loc.iata === value}
                // mousedown would blur the input before the click lands: keep the focus where it is.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(loc)}
                onMouseMove={() => setActiveIndex(index)}
                className={`flex items-center justify-between p-3.5 cursor-pointer transition-colors ${
                  index === activeIndex ? 'bg-airline-blue-light/70' : 'hover:bg-airline-blue-light/50'
                } ${loc.iata === value ? 'font-semibold' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-airline-blue shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {loc.ciudad}, {loc.paisNombre}
                    </div>
                    <div className="text-xs text-slate-500">{loc.nombre}</div>
                  </div>
                </div>
                <span className="font-mono text-xs font-black px-2 py-1 rounded bg-slate-100 text-airline-navy border border-slate-200 shrink-0">
                  {loc.iata}
                </span>
              </li>
            ))}
          </ul>

          {isError && (
            <div className="p-6 text-center text-xs text-slate-600" role="alert">
              No pudimos cargar los aeropuertos.{' '}
              <button type="button" onClick={() => refetch()} className="font-bold text-brand-gold-dark underline">
                Reintentar
              </button>
            </div>
          )}
          {!isError && !isLoading && options.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500">
              No encontramos aeropuertos para &quot;{query}&quot;.
            </div>
          )}

          <div className="sr-only" role="status" aria-live="polite">
            {isLoading ? 'Buscando aeropuertos' : `${options.length} resultados disponibles`}
          </div>
        </div>
      )}
    </div>
  );
};

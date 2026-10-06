import React, { useState, useRef, useEffect } from 'react';
import { MapPin, PlaneTakeoff, PlaneLanding, X, Search, Loader2 } from 'lucide-react';
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

export const AirportPicker: React.FC<AirportPickerProps> = ({
  label,
  placeholder,
  value,
  onChange,
  type,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: localidades, isLoading, isError, refetch } = useLocalidades(searchQuery);

  // Find currently selected location
  const selectedLocation = localidades?.find((l) => l.iata === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (loc: LocalidadViewDto) => {
    onChange(loc.iata, loc);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  const Icon = type === 'origin' ? PlaneTakeoff : PlaneLanding;

  return (
    <div ref={containerRef} className="relative w-full">
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
        {label}
      </label>

      {/* Selector Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={`flex items-center justify-between w-full h-[54px] px-3.5 rounded-xl border bg-white cursor-pointer transition-all ${
          isOpen
            ? 'border-airline-blue ring-2 ring-airline-blue/20 shadow-sm'
            : error
            ? 'border-red-400 bg-red-50/20'
            : 'border-slate-300 hover:border-slate-400'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <Icon className="w-5 h-5 text-airline-navy shrink-0" />
          <div className="text-left truncate">
            {value ? (
              <div>
                <span className="font-extrabold text-airline-navy text-base mr-2">{value}</span>
                <span className="text-slate-700 text-sm font-medium">
                  {selectedLocation ? selectedLocation.ciudad : value}
                </span>
              </div>
            ) : (
              <span className="text-slate-400 text-sm">{placeholder}</span>
            )}
          </div>
        </div>

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Borrar selección"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in-50 zoom-in-95">
          {/* Search Field */}
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Escribe ciudad, aeropuerto o código IATA (ej. BOG, UIO)..."
              className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />}
          </div>

          {/* Location List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100" role="listbox">
            {localidades && localidades.length > 0 ? (
              localidades.map((loc) => (
                <div
                  key={loc.iata}
                  role="option"
                  aria-selected={loc.iata === value}
                  onClick={() => handleSelect(loc)}
                  className={`flex items-center justify-between p-3.5 hover:bg-airline-blue-light/50 cursor-pointer transition-colors ${
                    loc.iata === value ? 'bg-airline-blue-light/70 font-semibold' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-airline-blue shrink-0 mt-0.5" />
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
                </div>
              ))
            ) : isError ? (
              <div className="p-6 text-center text-xs text-slate-600">
                No pudimos cargar los aeropuertos.{' '}
                <button type="button" onClick={() => refetch()} className="font-bold text-brand-gold-dark underline">
                  Reintentar
                </button>
              </div>
            ) : !isLoading ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No encontramos aeropuertos para &quot;{searchQuery}&quot;.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

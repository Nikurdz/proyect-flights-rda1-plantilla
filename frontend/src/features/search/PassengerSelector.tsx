import React, { useState, useRef, useEffect, useId } from 'react';
import { Users, Plus, Minus } from 'lucide-react';

export interface PassengerCounts {
  adt: number;
  chd: number;
  inf: number;
}

export interface PassengerSelectorProps {
  counts: PassengerCounts;
  onChange: (counts: PassengerCounts) => void;
  maxTotal?: number;
}

export const PassengerSelector: React.FC<PassengerSelectorProps> = ({
  counts,
  onChange,
  maxTotal = 9,
}) => {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const totalPassengers = counts.adt + counts.chd + counts.inf;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpdate = (type: keyof PassengerCounts, delta: number) => {
    const next = { ...counts };

    if (type === 'adt') {
      const nextAdt = Math.max(1, counts.adt + delta);
      if (nextAdt + counts.chd + counts.inf <= maxTotal) {
        next.adt = nextAdt;
        // Infants cannot exceed adults
        if (next.inf > nextAdt) {
          next.inf = nextAdt;
        }
      }
    } else if (type === 'chd') {
      const nextChd = Math.max(0, counts.chd + delta);
      if (counts.adt + nextChd + counts.inf <= maxTotal) {
        next.chd = nextChd;
      }
    } else if (type === 'inf') {
      const nextInf = Math.max(0, counts.inf + delta);
      // Infants cannot exceed adults and total within limit
      if (nextInf <= counts.adt && counts.adt + counts.chd + nextInf <= maxTotal) {
        next.inf = nextInf;
      }
    }

    onChange(next);
  };

  // Generate passenger summary label
  const getSummaryLabel = () => {
    const parts: string[] = [];
    if (counts.adt === 1) parts.push('1 Adulto');
    else parts.push(`${counts.adt} Adultos`);

    if (counts.chd === 1) parts.push('1 Niño');
    else if (counts.chd > 1) parts.push(`${counts.chd} Niños`);

    if (counts.inf === 1) parts.push('1 Bebé');
    else if (counts.inf > 1) parts.push(`${counts.inf} Bebés`);

    return parts.join(', ');
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && isOpen) {
          e.stopPropagation();
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <span id={`${uid}-label`} className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
        Pasajeros
      </span>

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full h-[54px] px-3.5 rounded-xl border bg-white cursor-pointer transition-all text-left ${
          isOpen
            ? 'border-airline-blue ring-2 ring-airline-blue/20 shadow-sm'
            : 'border-slate-300 hover:border-slate-400'
        }`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-labelledby={`${uid}-label ${uid}-summary`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <Users className="w-5 h-5 text-airline-navy shrink-0" aria-hidden="true" />
          <div className="text-left truncate">
            <span id={`${uid}-summary`} className="text-sm font-semibold text-slate-900 block truncate">
              {getSummaryLabel()}
            </span>
            <span className="text-xs text-slate-500">Cabina Economy</span>
          </div>
        </div>
      </button>

      {/* Popover Controls */}
      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Seleccionar pasajeros"
          className="absolute right-0 sm:left-0 top-full mt-2 z-50 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 space-y-4 animate-in fade-in-50 zoom-in-95">
          {/* Adultos */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-900">Adultos</div>
              <div className="text-xs text-slate-500">Desde 12 años</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={counts.adt <= 1}
                onClick={() => handleUpdate('adt', -1)}
                className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Restar adulto"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-4 text-center font-bold text-sm" role="status" aria-live="polite" aria-label={`${counts.adt} adultos`}>{counts.adt}</span>
              <button
                type="button"
                disabled={totalPassengers >= maxTotal}
                onClick={() => handleUpdate('adt', 1)}
                className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Sumar adulto"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Niños */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <div className="text-sm font-bold text-slate-900">Niños</div>
              <div className="text-xs text-slate-500">De 2 a 11 años</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={counts.chd <= 0}
                onClick={() => handleUpdate('chd', -1)}
                className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Restar niño"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-4 text-center font-bold text-sm" role="status" aria-live="polite" aria-label={`${counts.chd} niños`}>{counts.chd}</span>
              <button
                type="button"
                disabled={totalPassengers >= maxTotal}
                onClick={() => handleUpdate('chd', 1)}
                className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Sumar niño"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Infantes */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <div className="text-sm font-bold text-slate-900">Bebés</div>
              <div className="text-xs text-slate-500">Menores de 2 años (en brazos)</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={counts.inf <= 0}
                onClick={() => handleUpdate('inf', -1)}
                className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Restar bebé"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-4 text-center font-bold text-sm" role="status" aria-live="polite" aria-label={`${counts.inf} bebés`}>{counts.inf}</span>
              <button
                type="button"
                disabled={counts.inf >= counts.adt || totalPassengers >= maxTotal}
                onClick={() => handleUpdate('inf', 1)}
                className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Sumar bebé"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            Máximo 9 pasajeros por reserva. Los bebés viajan en el regazo de un adulto.
          </div>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              triggerRef.current?.focus();
            }}
            className="w-full py-2 bg-airline-navy text-white text-xs font-bold rounded-lg hover:bg-airline-navy-light transition-colors"
          >
            Listo
          </button>
        </div>
      )}
    </div>
  );
};

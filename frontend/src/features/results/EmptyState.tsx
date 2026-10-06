import React from 'react';
import { CalendarSearch, ChevronLeft, ChevronRight, Plane } from 'lucide-react';
import type { FechaAlternativaDto } from '../../api/types';
import { MoneyText } from '../../components/common/MoneyText';
import { Button } from '../../components/ui/Button';
import { formatDay } from '../../lib/labels';

export interface EmptyStateProps {
  origin?: string;
  destination?: string;
  /** City names when known, else the IATA codes. */
  originLabel?: string;
  destinationLabel?: string;
  /** YYYY-MM-DD of the day with no flights. */
  date?: string;
  alternatives?: FechaAlternativaDto[];
  canGoPrevious: boolean;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onPickDate: (date: string) => void;
  onModifySearch: () => void;
}

/** "No flights" is a normal answer, not an error: say so plainly and offer the next best step. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  originLabel,
  destinationLabel,
  date,
  alternatives = [],
  canGoPrevious,
  onPreviousDay,
  onNextDay,
  onPickDate,
  onModifySearch,
}) => {
  const route = originLabel && destinationLabel ? `${originLabel} → ${destinationLabel}` : null;

  return (
    <div className="mx-auto my-6 max-w-2xl rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <Plane className="h-8 w-8 -rotate-45 text-brand-black" aria-hidden="true" />
      </div>

      <h2 className="mb-2 text-xl font-bold text-slate-900">No hay vuelos disponibles para esta fecha</h2>
      <p className="mb-6 text-sm leading-relaxed text-slate-600">
        {route ? (
          <>
            No tenemos vuelos directos <strong className="text-slate-900">{route}</strong>
            {date ? ` el ${formatDay(`${date}T12:00:00Z`)}` : ''}. Prueba con otro día o cambia tu búsqueda.
          </>
        ) : (
          'No encontramos vuelos con estos datos. Prueba con otro día o cambia tu búsqueda.'
        )}
      </p>

      {alternatives.length > 0 && (
        <div className="mb-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Días cercanos con vuelos</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {alternatives.slice(0, 5).map((alternative) => (
              <button
                key={alternative.fecha}
                type="button"
                onClick={() => onPickDate(alternative.fecha)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-brand-gold hover:bg-brand-gold-light"
              >
                <span className="block font-bold text-slate-900">{formatDay(`${alternative.fecha}T12:00:00Z`)}</span>
                <span className="text-slate-500">
                  desde <MoneyText amount={alternative.precioDesde.monto} currency={alternative.precioDesde.moneda} size="sm" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button type="button" variant="outline" size="md" onClick={onPreviousDay} disabled={!canGoPrevious} className="w-full gap-1 sm:w-auto">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Día anterior
        </Button>
        <Button type="button" variant="outline" size="md" onClick={onNextDay} className="w-full gap-1 sm:w-auto">
          Día siguiente
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button type="button" variant="primary" size="md" onClick={onModifySearch} className="w-full gap-2 sm:w-auto">
          <CalendarSearch className="h-4 w-4" aria-hidden="true" />
          Modificar búsqueda
        </Button>
      </div>
    </div>
  );
};

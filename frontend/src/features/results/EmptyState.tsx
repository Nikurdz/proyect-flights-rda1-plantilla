import React from 'react';
import { CalendarSearch, ChevronLeft, ChevronRight, Plane } from 'lucide-react';
import { EmptyState as EmptyStatePanel } from '../../components/ui/EmptyState';
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
  const route = originLabel && destinationLabel ? `${originLabel} a ${destinationLabel}` : null;

  const description = route ? (
    <>
      No tenemos vuelos directos de <strong className="font-semibold text-ink">{route}</strong>
      {date ? ` el ${formatDay(`${date}T12:00:00Z`)}` : ''}. Prueba otro día o cambia tu búsqueda.
    </>
  ) : (
    'No encontramos vuelos con estos datos. Prueba otro día o cambia tu búsqueda.'
  );

  return (
    <div className="mx-auto my-6 max-w-2xl rounded-xl border border-line bg-surface">
      <EmptyStatePanel
        icon={<Plane className="-rotate-45" />}
        title="No hay vuelos disponibles para este día"
        description={description}
        action={
          <div className="flex flex-col items-center gap-5">
            {alternatives.length > 0 && (
              <div>
                <p className="mb-2 text-small font-medium text-ink">Días cercanos con vuelos</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {alternatives.slice(0, 5).map((alternative) => (
                    <button
                      key={alternative.fecha}
                      type="button"
                      onClick={() => onPickDate(alternative.fecha)}
                      className="min-h-[44px] rounded-lg border border-line-strong px-3 py-2 text-left text-small transition-colors hover:border-gold-text hover:bg-gold-soft"
                    >
                      <span className="block font-medium text-ink">{formatDay(`${alternative.fecha}T12:00:00Z`)}</span>
                      <span className="text-muted">
                        desde <MoneyText amount={alternative.precioDesde.monto} currency={alternative.precioDesde.moneda} size="sm" className="num text-ink" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
              <Button type="button" variant="outline" onClick={onPreviousDay} disabled={!canGoPrevious} className="w-full gap-1 sm:w-auto">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Día anterior
              </Button>
              <Button type="button" variant="outline" onClick={onNextDay} className="w-full gap-1 sm:w-auto">
                Día siguiente
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="primary" onClick={onModifySearch} className="w-full gap-2 sm:w-auto">
                <CalendarSearch className="h-4 w-4" aria-hidden="true" />
                Modificar búsqueda
              </Button>
            </div>
          </div>
        }
      />
    </div>
  );
};

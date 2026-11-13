import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDaysToDate, getValidSearchDateString } from '../../lib/dates';
import { MoneyText } from '../../components/common/MoneyText';
import type { FechaAlternativaDto, MontoDto } from '../../api/types';

export interface DateNavigatorProps {
  currentDate?: string;
  minDate?: string;
  lowestPrice?: MontoDto;
  fechasAlternativas?: FechaAlternativaDto[];
  onSelectDate: (fecha: string) => void;
  label?: string;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  currentDate = getValidSearchDateString(),
  minDate = getValidSearchDateString(),
  lowestPrice,
  fechasAlternativas = [],
  onSelectDate,
  label = 'Cambia el día de viaje',
}) => {
  // Generate 7-day window: 3 days before, current day, 3 days after
  const daysWindow = useMemo(() => {
    const list: string[] = [];
    for (let offset = -3; offset <= 3; offset++) {
      const d = addDaysToDate(currentDate, offset);
      // Ensure we don't include dates before minDate (today in Ecuador)
      if (d >= minDate) {
        list.push(d);
      }
    }
    // If fewer than 7 days because of minDate limit, fill ahead
    while (list.length < 7) {
      const last = list[list.length - 1] || currentDate;
      list.push(addDaysToDate(last, 1));
    }
    return list;
  }, [currentDate, minDate]);

  // Map prices from alternative dates or current lowest price
  const priceMap = useMemo(() => {
    const map = new Map<string, MontoDto>();
    if (lowestPrice && currentDate) {
      map.set(currentDate, lowestPrice);
    }
    fechasAlternativas.forEach((fa) => {
      if (fa.precioDesde) {
        map.set(fa.fecha, fa.precioDesde);
      }
    });
    return map;
  }, [fechasAlternativas, lowestPrice, currentDate]);

  // Keep the chosen day visible in the horizontal strip (phones), without animating if the user prefers less motion.
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = selectedRef.current;
    if (!el || typeof el.scrollIntoView !== 'function') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [currentDate]);

  const canGoPrevious = addDaysToDate(currentDate, -1) >= minDate;

  const handlePreviousDay = () => {
    if (canGoPrevious) {
      onSelectDate(addDaysToDate(currentDate, -1));
    }
  };

  const handleNextDay = () => {
    onSelectDate(addDaysToDate(currentDate, 1));
  };

  const stepButton =
    'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border border-line-strong px-2.5 text-small font-medium text-ink transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-35';

  return (
    <section aria-label={label} className="mb-6 rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-ink">{label}</h2>

        <div className="flex items-center gap-2">
          <button type="button" onClick={handlePreviousDay} disabled={!canGoPrevious} className={stepButton} title="Ver día anterior" aria-label="Ver día anterior">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Día anterior</span>
          </button>

          <button type="button" onClick={handleNextDay} className={stepButton} title="Ver día siguiente" aria-label="Ver día siguiente">
            <span className="hidden sm:inline">Día siguiente</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <input
            type="date"
            min={minDate}
            value={currentDate}
            onChange={(e) => e.target.value && onSelectDate(e.target.value)}
            aria-label="Elegir una fecha en el calendario"
            className="min-h-[44px] cursor-pointer rounded-lg border border-line-strong bg-surface px-2.5 text-small text-ink hover:border-ink/50 focus-visible:border-gold-text"
          />
        </div>
      </div>

      {/* Phones: one scrollable row that snaps day by day. md+: the 7-column grid. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-7 md:overflow-visible md:px-0 md:pb-0">
        {daysWindow.map((dayStr) => {
          const isSelected = dayStr === currentDate;
          const [y, m, d] = dayStr.split('-').map(Number);
          const dateObj = new Date(Date.UTC(y, m - 1, d));

          const dayOfWeek = dateObj.toLocaleDateString('es-EC', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
          const dayAndMonth = dateObj.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', timeZone: 'UTC' });
          const price = priceMap.get(dayStr);

          return (
            <button
              key={dayStr}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              aria-pressed={isSelected}
              aria-current={isSelected ? 'date' : undefined}
              onClick={() => onSelectDate(dayStr)}
              className={`flex min-h-[72px] w-[7.5rem] shrink-0 snap-center flex-col md:w-auto md:shrink justify-between rounded-lg border p-2.5 text-left transition-colors ${
                isSelected ? 'border-ink bg-ink text-on-ink' : 'border-line bg-paper text-ink hover:border-line-strong'
              }`}
            >
              <span>
                <span className={`block text-small capitalize ${isSelected ? 'text-on-ink/80' : 'text-muted'}`}>{dayOfWeek}</span>
                <span className="block text-body font-medium">{dayAndMonth}</span>
              </span>
              <span className="num mt-1 block text-small font-semibold">
                {price ? <MoneyText amount={price.monto} currency={price.moneda} size="sm" /> : <span className={`font-normal ${isSelected ? 'text-on-ink/80' : 'text-muted'}`}>{isSelected ? 'Día elegido' : 'Ver vuelos'}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

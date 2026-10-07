import React, { useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
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
  label = 'Selecciona otra fecha de viaje:',
}) => {
  // Generate 7-day window: 3 days before, current day, 3 days after
  const daysWindow = useMemo(() => {
    const list: string[] = [];
    for (let offset = -3; offset <= 3; offset++) {
      const d = addDaysToDate(currentDate, offset);
      // Ensure we don't include dates before minDate (UTC today)
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

  const canGoPrevious = addDaysToDate(currentDate, -1) >= minDate;

  const handlePreviousDay = () => {
    if (canGoPrevious) {
      onSelectDate(addDaysToDate(currentDate, -1));
    }
  };

  const handleNextDay = () => {
    onSelectDate(addDaysToDate(currentDate, 1));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm mb-6 space-y-3">
      {/* Header bar with controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#C5A880]" aria-hidden="true" />
          <span className="text-xs font-bold text-slate-800">{label}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Step Buttons */}
          <button
            type="button"
            onClick={handlePreviousDay}
            disabled={!canGoPrevious}
            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 min-h-[44px] min-w-[44px] justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-700"
            title="Ver día anterior"
            aria-label="Ver día anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Día anterior</span>
          </button>

          <button
            type="button"
            onClick={handleNextDay}
            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 min-h-[44px] min-w-[44px] justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700"
            title="Ver día siguiente"
            aria-label="Ver día siguiente"
          >
            <span className="hidden sm:inline">Día siguiente</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          {/* Direct Date Picker Dropdown */}
          <div className="relative inline-block">
            <input
              type="date"
              min={minDate}
              value={currentDate}
              onChange={(e) => e.target.value && onSelectDate(e.target.value)}
              aria-label="Elegir fecha específica en calendario"
              className="text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
            />
          </div>
        </div>
      </div>

      {/* 7-Days Strip Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {daysWindow.map((dayStr) => {
          const isSelected = dayStr === currentDate;
          const [y, m, d] = dayStr.split('-').map(Number);
          const dateObj = new Date(Date.UTC(y, m - 1, d));

          const dayOfWeek = dateObj
            .toLocaleDateString('es-EC', { weekday: 'short', timeZone: 'UTC' })
            .toUpperCase()
            .replace('.', '');
          const dayAndMonth = dateObj.toLocaleDateString('es-EC', {
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
          });

          const price = priceMap.get(dayStr);

          return (
            <button
              key={dayStr}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectDate(dayStr)}
              className={`p-2.5 rounded-xl text-center transition-all flex flex-col justify-between min-h-[72px] ${
                isSelected
                  ? 'bg-[#0B0E14] brand-tab-active text-white border-2 border-[#C5A880] ring-2 ring-[#C5A880]/30 shadow-sm'
                  : 'bg-slate-50/70 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-800'
              }`}
            >
              <div>
                <span
                  className={`block text-[10px] font-black tracking-wider ${
                    isSelected ? 'text-[#C5A880]' : 'text-slate-400'
                  }`}
                >
                  {dayOfWeek}
                </span>
                <span className="block text-xs font-bold font-sans mt-0.5">{dayAndMonth}</span>
              </div>

              <div className="mt-1">
                {price ? (
                  <span className={`block text-[10px] font-mono font-bold ${
                    isSelected ? 'text-white' : 'text-emerald-700'
                  }`}>
                    <MoneyText amount={price.monto} currency={price.moneda} size="sm" />
                  </span>
                ) : (
                  <span className={`block text-[9px] ${
                    isSelected ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    {isSelected ? 'Fecha actual' : 'Ver vuelos'}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

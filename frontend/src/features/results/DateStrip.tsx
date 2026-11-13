import React from 'react';
import { Calendar } from 'lucide-react';
import type { FechaAlternativaDto } from '../../api/types';
import { MoneyText } from '../../components/common/MoneyText';

export interface DateStripProps {
  currentDate?: string;
  fechasAlternativas?: FechaAlternativaDto[];
  onSelectDate: (fecha: string) => void;
}

export const DateStrip: React.FC<DateStripProps> = ({
  currentDate,
  fechasAlternativas = [],
  onSelectDate,
}) => {
  if (!fechasAlternativas || fechasAlternativas.length === 0) return null;

  return (
    <div className="bg-surface p-3 rounded-xl border border-line mb-5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted mb-2 px-1">
        <Calendar className="w-3.5 h-3.5 text-gold-text" aria-hidden="true" />
        <span>Fechas cercanas con vuelos disponibles:</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {fechasAlternativas.map((item) => {
          const isSelected = item.fecha === currentDate;
          const [y, m, d] = item.fecha.split('-').map(Number);
          const dateObj = new Date(y, m - 1, d);
          const dayName = dateObj.toLocaleDateString('es-EC', { weekday: 'short' });
          const dayNumber = dateObj.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });

          return (
            <button
              key={item.fecha}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectDate(item.fecha)}
              className={`flex-1 min-w-[110px] p-2.5 rounded-xl border text-center transition-all ${
                isSelected
                  ? 'border-gold-text bg-gold-soft/60 ring-2 ring-gold-text shadow-sm'
                  : 'border-line hover:border-line-strong hover:bg-paper'
              }`}
            >
              <div className="text-xs font-medium text-muted capitalize">{dayName}</div>
              <div className="text-small font-semibold text-ink">{dayNumber}</div>
              <div className="mt-1 text-xs text-ink font-bold">
                <MoneyText
                  amount={item.precioDesde?.monto}
                  currency={item.precioDesde?.moneda}
                  size="sm"
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

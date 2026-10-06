import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import type { Ordenamiento } from '../../api/types';

export interface SortingBarProps {
  currentSort: Ordenamiento;
  onSortChange: (sort: Ordenamiento) => void;
  totalResults: number;
}

const SORT_OPTIONS: { value: Ordenamiento; label: string }[] = [
  { value: 'RECOMENDADO', label: 'Recomendado' },
  { value: 'MAS_BARATOS', label: 'Precio más bajo' },
  { value: 'MAS_RAPIDOS', label: 'Menor duración' },
  { value: 'SALIDA_TEMPRANO', label: 'Salida más temprano' },
  { value: 'SALIDA_TARDE', label: 'Salida más tarde' },
  { value: 'LLEGADA_TEMPRANO', label: 'Llegada más temprano' },
  { value: 'LLEGADA_TARDE', label: 'Llegada más tarde' },
];

export const SortingBar: React.FC<SortingBarProps> = ({
  currentSort,
  onSortChange,
  totalResults,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200/80 shadow-sm mb-4">
      <div className="text-xs sm:text-sm font-semibold text-slate-700">
        <span className="text-airline-navy font-bold">{totalResults}</span>{' '}
        {totalResults === 1 ? 'vuelo directo disponible' : 'vuelos directos disponibles'}
      </div>

      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
        <label htmlFor="sorting-select" className="text-xs font-semibold text-slate-500 whitespace-nowrap">
          Ordenar por:
        </label>
        <select
          id="sorting-select"
          value={currentSort}
          onChange={(e) => onSortChange(e.target.value as Ordenamiento)}
          className="text-xs font-bold text-airline-navy bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-airline-blue cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

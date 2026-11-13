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
    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div role="status" aria-live="polite" className="text-small text-muted">
        <span className="num font-semibold text-ink">{totalResults}</span>{' '}
        {totalResults === 1 ? 'vuelo directo disponible' : 'vuelos directos disponibles'}
      </div>

      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <label htmlFor="sorting-select" className="whitespace-nowrap text-small text-muted">
          Ordenar por
        </label>
        <select
          id="sorting-select"
          value={currentSort}
          onChange={(e) => onSortChange(e.target.value as Ordenamiento)}
          className="min-h-[44px] cursor-pointer rounded-lg border border-line-strong bg-surface px-2.5 text-small text-ink hover:border-ink/50 focus-visible:border-gold-text sm:min-h-[36px]"
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

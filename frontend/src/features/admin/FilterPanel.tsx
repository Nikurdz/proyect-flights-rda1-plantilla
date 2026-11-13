import React, { useId, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

/** Collapsible filters for screens with many of them: the toggle says how many are active. */
export const FilterPanel: React.FC<{ activeCount?: number; defaultOpen?: boolean; children: React.ReactNode; label?: string }> = ({
  activeCount = 0,
  defaultOpen = false,
  children,
  label = 'Filtros',
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="mb-5 rounded-xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-left text-sm font-medium text-ink"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted" aria-hidden="true" />
          {label}
          {activeCount > 0 && (
            <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs text-gold-text">
              {activeCount} activo{activeCount === 1 ? '' : 's'}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div id={id} hidden={!open} className="border-t border-line p-4">
        {children}
      </div>
    </div>
  );
};

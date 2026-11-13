import React, { useState, useRef, useEffect, useId } from 'react';
import { Users, Plus, Minus } from 'lucide-react';
import { MAX_PASSENGERS } from '../../lib/passenger-rules';
import { describePassengers } from '../../lib/search';
import { Button } from '../../components/ui/Button';

export interface PassengerCounts {
  adt: number;
  yth: number;
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
  maxTotal = MAX_PASSENGERS,
}) => {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const totalPassengers = counts.adt + counts.yth + counts.chd + counts.inf;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // While the panel is open, Escape closes it and gives the focus back to the trigger.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleUpdate = (type: keyof PassengerCounts, delta: number) => {
    const next = { ...counts };

    const sum = (c: PassengerCounts) => c.adt + c.yth + c.chd + c.inf;

    if (type === 'adt') {
      const nextAdt = Math.max(1, counts.adt + delta);
      if (sum({ ...counts, adt: nextAdt }) <= maxTotal) {
        next.adt = nextAdt;
        // Infants cannot exceed adults
        if (next.inf > nextAdt) {
          next.inf = nextAdt;
        }
      }
    } else if (type === 'yth' || type === 'chd') {
      const nextValue = Math.max(0, counts[type] + delta);
      if (sum({ ...counts, [type]: nextValue }) <= maxTotal) {
        next[type] = nextValue;
      }
    } else if (type === 'inf') {
      const nextInf = Math.max(0, counts.inf + delta);
      // Infants cannot exceed adults (youths and children do not count for that cap) and the total stays within the limit
      if (nextInf <= counts.adt && sum({ ...counts, inf: nextInf }) <= maxTotal) {
        next.inf = nextInf;
      }
    }

    onChange(next);
  };

  const summary = describePassengers(counts);

  return (
    <div ref={containerRef} className="relative w-full">
      <span id={`${uid}-label`} className="mb-1.5 block text-sm font-medium text-ink">
        Pasajeros
      </span>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-12 w-full items-center gap-3 rounded-lg border bg-surface px-3.5 text-left transition-colors ${
          isOpen ? 'border-gold-text ring-2 ring-gold-text/25' : 'border-line-strong hover:border-ink/50'
        }`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-labelledby={`${uid}-label ${uid}-summary`}
      >
        <Users className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
        <span id={`${uid}-summary`} className="block truncate text-body text-ink">
          {summary}
        </span>
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Elegir pasajeros"
          className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] space-y-1 rounded-xl border border-line bg-surface p-4 shadow-elevated sm:left-0 sm:right-auto"
        >
          <CounterRow
            title="Adultos"
            hint="Desde 18 años"
            noun="adultos"
            count={counts.adt}
            removeLabel="Restar adulto"
            addLabel="Sumar adulto"
            removeDisabled={counts.adt <= 1}
            addDisabled={totalPassengers >= maxTotal}
            onRemove={() => handleUpdate('adt', -1)}
            onAdd={() => handleUpdate('adt', 1)}
          />
          <CounterRow
            title="Joven (12 a 17 años)"
            hint="Viajan con asiento propio"
            noun="jóvenes"
            count={counts.yth}
            removeLabel="Restar joven"
            addLabel="Sumar joven"
            removeDisabled={counts.yth <= 0}
            addDisabled={totalPassengers >= maxTotal}
            onRemove={() => handleUpdate('yth', -1)}
            onAdd={() => handleUpdate('yth', 1)}
          />
          <CounterRow
            title="Niños"
            hint="De 2 a 11 años"
            noun="niños"
            count={counts.chd}
            removeLabel="Restar niño"
            addLabel="Sumar niño"
            removeDisabled={counts.chd <= 0}
            addDisabled={totalPassengers >= maxTotal}
            onRemove={() => handleUpdate('chd', -1)}
            onAdd={() => handleUpdate('chd', 1)}
          />
          <CounterRow
            title="Bebés"
            hint="Menores de 2 años (en brazos)"
            noun="bebés"
            count={counts.inf}
            removeLabel="Restar bebé"
            addLabel="Sumar bebé"
            removeDisabled={counts.inf <= 0}
            addDisabled={counts.inf >= counts.adt || totalPassengers >= maxTotal}
            onRemove={() => handleUpdate('inf', -1)}
            onAdd={() => handleUpdate('inf', 1)}
          />

          <p className="border-t border-line pt-3 text-small text-muted">
            Máximo {maxTotal} pasajeros por reserva. Cada bebé viaja en brazos de un adulto.
          </p>

          <Button
            type="button"
            variant="primary"
            size="sm"
            className="mt-1 w-full"
            onClick={() => {
              setIsOpen(false);
              triggerRef.current?.focus();
            }}
          >
            Listo
          </Button>
        </div>
      )}
    </div>
  );
};

interface CounterRowProps {
  title: string;
  hint: string;
  noun: string;
  count: number;
  removeLabel: string;
  addLabel: string;
  removeDisabled: boolean;
  addDisabled: boolean;
  onRemove: () => void;
  onAdd: () => void;
}

const stepButton =
  'inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-ink transition-colors hover:bg-ink/5 disabled:pointer-events-none disabled:opacity-35';

const CounterRow: React.FC<CounterRowProps> = ({ title, hint, noun, count, removeLabel, addLabel, removeDisabled, addDisabled, onRemove, onAdd }) => (
  <div className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0 first:pt-0">
    <div className="min-w-0">
      <div className="text-body font-medium text-ink">{title}</div>
      <div className="text-small text-muted">{hint}</div>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" disabled={removeDisabled} onClick={onRemove} className={stepButton} aria-label={removeLabel}>
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="num w-5 text-center text-body font-semibold" role="status" aria-live="polite" aria-label={`${count} ${noun}`}>
        {count}
      </span>
      <button type="button" disabled={addDisabled} onClick={onAdd} className={stepButton} aria-label={addLabel}>
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
);

import React from 'react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';

export interface StepperStep {
  id: string;
  /** Short name in the traveller's words ("Pasajeros"). */
  label: string;
  /** Extra line under the label, hidden on phones. */
  description?: string;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Index (0-based) of the current step. */
  current: number;
  /** Called with the index when a completed step is activated (omit to make steps read-only). */
  onStepClick?: (index: number) => void;
  /** Accessible name of the list. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Generic step indicator. The current step has `aria-current="step"`; a polite live region
 * announces "Paso 2 de 4: Facturación" every time it changes (the page should also move focus to
 * the new step's heading). Completed steps show a check (not only a color) and can be clickable.
 */
export const Stepper: React.FC<StepperProps> = ({ steps, current, onStepClick, ariaLabel = 'Progreso', className }) => {
  const active = steps[current];
  return (
    <nav aria-label={ariaLabel} className={className}>
      <p className="sr-only" role="status" aria-live="polite">
        {active ? `Paso ${current + 1} de ${steps.length}: ${active.label}` : ''}
      </p>
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const done = index < current;
          const isCurrent = index === current;
          const clickable = done && onStepClick;
          const content = (
            <>
              <span
                className={clsx(
                  'num flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                  isCurrent && 'border-ink bg-ink text-on-ink',
                  done && 'border-gold-text bg-gold-soft text-gold-text',
                  !done && !isCurrent && 'border-line-strong text-muted'
                )}
                aria-hidden="true"
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className={clsx('min-w-0 text-left', !isCurrent && 'hidden sm:block')}>
                <span className={clsx('block truncate text-sm', isCurrent ? 'font-semibold text-ink' : 'text-muted')}>
                  {step.label}
                  {done && <span className="sr-only"> (completado)</span>}
                </span>
                {step.description && <span className="hidden truncate text-xs text-muted lg:block">{step.description}</span>}
              </span>
            </>
          );
          return (
            <li key={step.id} aria-current={isCurrent ? 'step' : undefined} className={clsx('flex min-w-0 items-center gap-2', index < steps.length - 1 && 'flex-1')}>
              {clickable ? (
                <button type="button" onClick={() => onStepClick(index)} className="flex min-h-[44px] items-center gap-2 rounded-lg pr-1 hover:text-ink sm:min-h-0">
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-2">{content}</div>
              )}
              {index < steps.length - 1 && <span className={clsx('h-px flex-1 min-w-4', done ? 'bg-gold-text' : 'bg-line')} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

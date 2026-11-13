import React, { useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { MoreHorizontal } from 'lucide-react';

export interface RowAction {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  /** Draws a divider above the item (separates destructive actions). */
  separated?: boolean;
}

/**
 * «Acciones» menu of a table row (WAI-ARIA menu button): the trigger has aria-haspopup / aria-expanded,
 * Arrow keys move, Home/End jump, Escape closes and returns focus to the trigger, Tab closes.
 * `subject` makes the trigger name unique ("Acciones de LA800").
 */
export const RowActionsMenu: React.FC<{ subject: string; actions: RowAction[] }> = ({ subject, actions }) => {
  const [open, setOpen] = useState(false);
  const [focusAt, setFocusAt] = useState<number | null>(null);
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setFocusAt(null);
    if (returnFocus) trigger.current?.focus();
  };

  const openAt = (index: number) => {
    setOpen(true);
    setFocusAt(index);
  };

  // Focus the requested item once the menu is rendered.
  useEffect(() => {
    if (open && focusAt !== null) items.current[focusAt]?.focus();
  }, [open, focusAt]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const focusItem = (index: number) => items.current[(index + actions.length) % actions.length]?.focus();

  const onTriggerKey = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openAt(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAt(actions.length - 1);
    }
  };

  const onMenuKey = (event: React.KeyboardEvent) => {
    const index = items.current.findIndex((el) => el === document.activeElement);
    if (event.key === 'ArrowDown') focusItem(index + 1);
    else if (event.key === 'ArrowUp') focusItem(index - 1);
    else if (event.key === 'Home') focusItem(0);
    else if (event.key === 'End') focusItem(actions.length - 1);
    else if (event.key === 'Escape') {
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
      return;
    } else return;
    event.preventDefault();
  };

  return (
    <div ref={root} className="relative inline-block text-left">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${uid}-menu` : undefined}
        aria-label={`Acciones de ${subject}`}
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={onTriggerKey}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/5 sm:min-h-[32px]"
      >
        Acciones
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={`${uid}-menu`}
          role="menu"
          tabIndex={-1}
          aria-label={`Acciones de ${subject}`}
          onKeyDown={onMenuKey}
          className="absolute right-0 z-20 mt-1 min-w-[12rem] rounded-xl border border-line bg-surface p-1 shadow-elevated"
        >
          {actions.map((action, index) => (
            <React.Fragment key={action.label}>
              {action.separated && <div role="separator" className="my-1 border-t border-line" />}
              <button
                ref={(el) => {
                  items.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  close(false);
                  action.onSelect();
                }}
                className={clsx(
                  'block w-full rounded-lg px-3 py-2 text-left text-sm focus-visible:bg-ink/10',
                  action.destructive ? 'font-medium text-danger hover:bg-danger-soft focus-visible:bg-danger-soft' : 'text-ink hover:bg-ink/5'
                )}
              >
                {action.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

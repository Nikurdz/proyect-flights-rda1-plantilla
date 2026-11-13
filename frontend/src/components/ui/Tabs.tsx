import React, { useId, useRef, useState } from 'react';
import { clsx } from 'clsx';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  /** Content of the panel. Only the selected panel is rendered. */
  panel: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Controlled selected tab id. */
  value?: string;
  /** Initial tab when uncontrolled (default: the first enabled one). */
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Accessible name of the tab list ("Secciones de la orden"). */
  ariaLabel: string;
  className?: string;
}

/**
 * Accessible tabs (WAI-ARIA): `tablist` / `tab` / `tabpanel`, roving tabindex, Left/Right arrows,
 * Home/End. Selection follows focus. Tab moves from the active tab into its panel.
 */
export const Tabs: React.FC<TabsProps> = ({ tabs, value, defaultValue, onValueChange, ariaLabel, className }) => {
  const uid = useId();
  const [inner, setInner] = useState(defaultValue ?? tabs.find((t) => !t.disabled)?.id ?? '');
  const selected = value ?? inner;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onValueChange?.(id);
  };

  const enabled = tabs.filter((t) => !t.disabled);

  const onKeyDown = (event: React.KeyboardEvent, id: string) => {
    const index = enabled.findIndex((t) => t.id === id);
    let next: TabItem | undefined;
    if (event.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length];
    else if (event.key === 'ArrowLeft') next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    event.preventDefault();
    select(next.id);
    refs.current[next.id]?.focus();
  };

  const active = tabs.find((t) => t.id === selected);

  return (
    <div className={className}>
      <div role="tablist" aria-label={ariaLabel} className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tab) => {
          const isSelected = tab.id === selected;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`${uid}-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => select(tab.id)}
              onKeyDown={(e) => onKeyDown(e, tab.id)}
              className={clsx(
                '-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                isSelected ? 'border-gold-text text-ink' : 'border-transparent text-muted hover:text-ink'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active && (
        <div role="tabpanel" id={`${uid}-panel-${active.id}`} aria-labelledby={`${uid}-tab-${active.id}`} tabIndex={0} className="pt-4">
          {active.panel}
        </div>
      )}
    </div>
  );
};

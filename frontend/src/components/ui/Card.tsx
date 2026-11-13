import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Elevated panel (menus, floating summaries): the only Card with a shadow. */
  elevated?: boolean;
  /** Highlights the border on hover; use only when the whole card is clickable. */
  hoverable?: boolean;
}

/** Flat panel: 12 px radius, a line border and no shadow unless `elevated`. */
export const Card: React.FC<CardProps> = ({ className, hoverable = false, elevated = false, children, ...props }) => {
  return (
    <div
      className={clsx(
        'min-w-0 rounded-xl border border-line bg-surface p-5 text-ink',
        elevated && 'shadow-elevated',
        hoverable && 'transition-colors hover:border-gold-text/60',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

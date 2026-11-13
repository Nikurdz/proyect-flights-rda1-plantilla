import React from 'react';
import { clsx } from 'clsx';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Accessible name of the scrollable region and the table ("Órdenes recientes"). */
  label: string;
  /** Tailwind max-height class that makes the body scroll under a sticky header (default 70vh). */
  maxHeightClass?: string;
  /** Wrapper classes (e.g. margins). */
  wrapperClassName?: string;
}

/**
 * Responsive table: the wrapper scrolls in both directions (keyboard reachable), the header row
 * stays visible (`sticky`), and every color comes from the theme tokens. Compose with
 * TableHead / TableBody / TableRow / TableHeaderCell / TableCell.
 *
 * Numbers: add `className="num text-right"` to the cell so figures line up.
 */
export const Table: React.FC<TableProps> = ({ label, maxHeightClass = 'max-h-[70vh]', wrapperClassName, className, children, ...props }) => (
  <div
    role="region"
    aria-label={`${label}, tabla desplazable`}
    tabIndex={0}
    className={clsx('overflow-auto rounded-xl border border-line bg-surface', maxHeightClass, wrapperClassName)}
  >
    <table aria-label={label} className={clsx('w-full min-w-max border-collapse text-sm text-ink', className)} {...props}>
      {children}
    </table>
  </div>
);

export const TableHead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, ...props }) => (
  <thead className={clsx('[&_th]:sticky [&_th]:top-0 [&_th]:z-10', className)} {...props} />
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, ...props }) => (
  <tbody className={clsx('divide-y divide-line', className)} {...props} />
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className, ...props }) => (
  <tr className={clsx('hover:bg-ink/[0.03]', className)} {...props} />
);

export const TableHeaderCell: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className, scope = 'col', ...props }) => (
  <th scope={scope} className={clsx('border-b border-line bg-paper px-4 py-2.5 text-left text-sm font-semibold text-muted', className)} {...props} />
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, ...props }) => (
  <td className={clsx('px-4 py-3 align-top', className)} {...props} />
);

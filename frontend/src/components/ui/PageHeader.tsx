import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface Breadcrumb {
  label: string;
  /** Omit for the current page. */
  to?: string;
}

export interface PageHeaderProps {
  /** The page's only h1. */
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  /** Buttons on the right (wrap below the title on phones). */
  actions?: React.ReactNode;
  className?: string;
}

/** Title block of a page: breadcrumbs, h1, description and actions, aligned left. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, breadcrumbs, actions, className = '' }) => (
  <header className={`mb-6 ${className}`}>
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav aria-label="Ruta de navegación" className="mb-2">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
          {breadcrumbs.map((crumb, index) => {
            const last = index === breadcrumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                {crumb.to && !last ? (
                  <Link to={crumb.to} className="rounded underline-offset-2 hover:text-ink hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current={last ? 'page' : undefined} className={last ? 'text-ink' : undefined}>
                    {crumb.label}
                  </span>
                )}
                {!last && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>
    )}
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-title font-semibold text-ink sm:text-heading">{title}</h1>
        {description && <p className="mt-1.5 max-w-[72ch] text-body text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </header>
);

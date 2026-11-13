import React from 'react';
import { clsx } from 'clsx';

export interface EmptyStateProps {
  /** Decorative icon (lucide). */
  icon?: React.ReactNode;
  /** What is missing, in the traveller's words ("Aún no tienes viajes"). */
  title: string;
  /** What to do next. */
  description?: React.ReactNode;
  /** The next step as a button or link. */
  action?: React.ReactNode;
  /** Heading level of the title (default 2). */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/** Empty or no-results screen: an invitation to act, centered. */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, headingLevel = 2, className }) => {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <div className={clsx('flex flex-col items-center px-4 py-12 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft text-gold-text [&>svg]:h-6 [&>svg]:w-6" aria-hidden="true">
          {icon}
        </div>
      )}
      <Heading className="text-lead font-semibold text-ink">{title}</Heading>
      {description && <p className="mt-1.5 max-w-md text-body text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

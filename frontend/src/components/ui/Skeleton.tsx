import React from 'react';
import { clsx } from 'clsx';

/** Loading placeholder. Decorative: announce the loading state with text (`role="status"`) in the parent. */
export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={clsx('rounded-md bg-ink/10 motion-safe:animate-pulse', className)} aria-hidden="true" {...props} />
);

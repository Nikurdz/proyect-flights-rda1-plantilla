import React from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline';
  size?: 'sm' | 'md';
  /** Optional icon (decorative). Status badges should carry one: color is never the only signal. */
  icon?: React.ReactNode;
}

const variants = {
  primary: 'bg-ink text-on-ink',
  secondary: 'bg-gold-soft text-gold-text',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  outline: 'border border-line-strong bg-transparent text-ink',
};

const sizes = {
  sm: 'gap-1 px-2 py-0.5 text-xs',
  md: 'gap-1.5 px-2.5 py-1 text-xs',
};

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'primary', size = 'md', icon, children, ...props }) => (
  <span
    className={clsx('inline-flex select-none items-center rounded-full font-medium leading-none', variants[variant], sizes[size], className)}
    {...props}
  >
    {icon && (
      <span className="inline-flex shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden="true">
        {icon}
      </span>
    )}
    {children}
  </span>
);

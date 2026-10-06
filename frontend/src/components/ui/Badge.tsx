import React from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}) => {
  const variants = {
    primary: 'bg-airline-navy text-white',
    secondary: 'bg-airline-blue-light text-airline-blue font-semibold',
    success: 'bg-emerald-100 text-emerald-800 font-semibold',
    warning: 'bg-amber-100 text-amber-800 font-semibold',
    danger: 'bg-red-100 text-red-800 font-semibold',
    outline: 'border border-slate-300 text-slate-700 bg-white',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium leading-none tracking-wide select-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

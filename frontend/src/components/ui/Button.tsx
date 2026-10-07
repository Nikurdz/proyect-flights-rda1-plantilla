import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-airline-blue focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none';

    const variants = {
      primary: 'bg-airline-navy text-white hover:bg-airline-navy-light active:bg-airline-navy-dark',
      secondary: 'bg-airline-blue text-white hover:bg-sky-800 active:bg-sky-900',
      accent: 'bg-brand-gold text-brand-black hover:bg-brand-gold-dark hover:text-white active:bg-brand-gold-dark',
      outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100',
      ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200',
      danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    };

    const sizes = {
      sm: 'min-h-[32px] px-3 py-1.5 text-xs',
      md: 'min-h-[44px] px-4 py-2.5 text-sm',
      lg: 'min-h-[44px] px-6 py-3.5 text-base font-semibold',
    };

    return (
      <button
        ref={ref}
        type="button"
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

import { clsx } from 'clsx';

export const variants = {
  primary: 'bg-ink text-on-ink hover:bg-ink/90 active:bg-ink/80',
  accent: 'bg-gold text-on-gold hover:bg-gold/90 active:bg-gold/80',
  secondary: 'bg-ink/[0.07] text-ink hover:bg-ink/[0.12] active:bg-ink/[0.16]',
  outline: 'border border-line-strong bg-transparent text-ink hover:bg-ink/5 active:bg-ink/10',
  ghost: 'bg-transparent text-ink hover:bg-ink/5 active:bg-ink/10',
  danger: 'bg-danger text-on-danger hover:bg-danger/90 active:bg-danger/80',
};

export const sizes = {
  // 44 px touch target on phones; compact (32 px, still >= 24 px per WCAG 2.5.8) from `sm` up.
  sm: 'min-h-[44px] sm:min-h-[32px] px-3 py-1.5 text-sm',
  md: 'min-h-[44px] px-4 py-2.5 text-sm',
  lg: 'min-h-[48px] px-6 py-3 text-body font-semibold',
};

const base =
  'inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50';

/** Classes of a button, for a link that must look like one (a single interactive element, not a link around a button). */
export const buttonClassName = (variant: keyof typeof variants = 'primary', size: keyof typeof sizes = 'md', className?: string): string =>
  clsx(base, variants[variant], sizes[size], className);


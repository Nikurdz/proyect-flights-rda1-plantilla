import React from 'react';
import { formatMoney } from '../../lib/money';

export interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount?: string | number | null;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const MoneyText: React.FC<MoneyTextProps> = ({
  amount,
  currency = 'USD',
  size = 'md',
  className = '',
  ...props
}) => {
  const formatted = formatMoney(amount, currency);

  const sizeClasses = {
    sm: 'text-xs font-semibold',
    md: 'text-sm font-semibold',
    lg: 'text-lg font-bold',
    xl: 'text-xl font-bold tracking-tight',
    '2xl': 'text-2xl font-extrabold tracking-tight',
  };

  return (
    <span className={`inline-block font-sans ${sizeClasses[size]} ${className}`} {...props}>
      {formatted}
    </span>
  );
};

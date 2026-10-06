import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, hoverable = false, children, ...props }) => {
  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-200',
        hoverable && 'hover:shadow-card-hover hover:border-airline-blue/40',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

import React from 'react';

export interface LogoProps {
  /** `full` shows the emblem and the wordmark, `icon` only the emblem. */
  variant?: 'full' | 'icon';
  /** True on dark surfaces (light wordmark). */
  inverted?: boolean;
  className?: string;
}

/**
 * RAM Alliance mark: a two-turn spiral (a ram's horn) with a dot at its tip, drawn in the brand
 * gold. Original artwork; the wordmark is plain text so it stays accessible and crisp at any size.
 */
export const Logo: React.FC<LogoProps> = ({ variant = 'full', inverted = true, className = '' }) => {
  return (
    <div className={`inline-flex select-none items-center gap-3 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0" role="img" aria-label="RAM Alliance">
        <g fill="none" stroke="#AB9159" strokeWidth="4.5" strokeLinecap="round">
          <path d="M32 14a18 18 0 1 0 18 18" />
          <path d="M32 24a8 8 0 1 0 8 8" />
        </g>
        <circle cx="50" cy="32" r="3.2" fill="#AB9159" />
      </svg>
      {variant === 'full' && (
        <span className={`text-[15px] font-semibold uppercase leading-none tracking-[0.32em] ${inverted ? 'text-white' : 'text-brand-black'}`}>
          RAM <span className="font-light">Alliance</span>
        </span>
      )}
    </div>
  );
};

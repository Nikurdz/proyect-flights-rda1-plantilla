import React from 'react';
import { clsx } from 'clsx';

export interface BoardingPassEndpoint {
  /** Airport code shown large ("UIO"). */
  code: string;
  /** City or airport name under the code ("Quito"). */
  city?: string;
  /** Time under the code ("07:00"). Tabular figures are applied. */
  time: string;
  /** Day shown next to the time ("lun 17 nov"). */
  date?: string;
}

export interface BoardingPassProps {
  origin: BoardingPassEndpoint;
  destination: BoardingPassEndpoint;
  /** Duration shown on the route line ("50 min"). */
  duration: string;
  /** Line under the route ("LATAM · LA2500 · directo"), already composed by the page. */
  details?: React.ReactNode;
  /** The stub (talón): price, PNR, a button. Omit for a pass without stub. */
  stub?: React.ReactNode;
  /** Accessible name of the whole pass (default: "Vuelo UIO a GYE"). */
  ariaLabel?: string;
  /** Color of the page behind the pass, used by the perforation notches (default `bg-paper`). */
  notchClassName?: string;
  className?: string;
}

/** Half-disc cut into the edge of the pass: only the half that lies inside the card is drawn. */
const Notch: React.FC<{ className: string; notchClassName: string }> = ({ className, notchClassName }) => (
  <span aria-hidden="true" className={clsx('absolute h-4 w-4 rounded-full border border-line', notchClassName, className)} />
);

/**
 * The boarding pass: big airport codes with the time under each, a route line with the duration,
 * and a stub separated by a perforation. On phones the stub moves below the pass.
 * Colors come from the theme tokens, so it works in light and dark.
 */
export const BoardingPass: React.FC<BoardingPassProps> = ({
  origin,
  destination,
  duration,
  details,
  stub,
  ariaLabel,
  notchClassName = 'bg-paper',
  className,
}) => {
  const name = ariaLabel ?? `Vuelo ${origin.code} a ${destination.code}`;
  return (
    <article aria-label={name} className={clsx('relative flex flex-col rounded-2xl border border-line bg-surface text-ink sm:flex-row', className)}>
      <div className="min-w-0 flex-1 p-5">
        <div className="flex items-start gap-3">
          <Endpoint data={origin} />
          <div className="mt-3.5 flex min-w-0 flex-1 flex-col items-center px-1" role="img" aria-label={`Duración ${duration}`}>
            <div className="flex w-full items-center" aria-hidden="true">
              <span className="h-2 w-2 shrink-0 rounded-full border-2 border-gold-text" />
              <span className="h-px flex-1 bg-line-strong" />
              <span className="h-2 w-2 shrink-0 rounded-full bg-gold-text" />
            </div>
            <span className="num mt-1.5 text-sm text-muted" aria-hidden="true">
              {duration}
            </span>
          </div>
          <Endpoint data={destination} align="right" />
        </div>
        {details && <div className="mt-4 text-sm text-muted">{details}</div>}
      </div>

      {stub && (
        <div className="relative flex shrink-0 flex-col justify-center gap-2 border-t-2 border-dashed border-line-strong p-5 sm:w-56 sm:border-l-2 sm:border-t-0">
          {/* Mobile: the divider is horizontal, notches on both sides. sm+: vertical, notches on top and bottom. */}
          <Notch notchClassName={notchClassName} className="-left-2 -top-[9px] [clip-path:inset(0_0_0_50%)] sm:-left-[9px] sm:-top-2 sm:[clip-path:inset(50%_0_0_0)]" />
          <Notch notchClassName={notchClassName} className="-right-2 -top-[9px] [clip-path:inset(0_50%_0_0)] sm:-bottom-2 sm:-left-[9px] sm:right-auto sm:top-auto sm:[clip-path:inset(0_0_50%_0)]" />
          {stub}
        </div>
      )}
    </article>
  );
};

const Endpoint: React.FC<{ data: BoardingPassEndpoint; align?: 'left' | 'right' }> = ({ data, align = 'left' }) => (
  <div className={clsx('shrink-0', align === 'right' && 'text-right')}>
    <p className="num text-display font-semibold leading-none" aria-label={data.city ? `${data.city} (${data.code})` : data.code}>
      {data.code}
    </p>
    <p className="num mt-2 text-lead font-medium">{data.time}</p>
    {(data.city || data.date) && (
      <p className="mt-0.5 max-w-[9rem] text-sm text-muted">{[data.city, data.date].filter(Boolean).join(' · ')}</p>
    )}
  </div>
);

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { clsx } from 'clsx';

export interface CountdownProps {
  venceEn?: string;
  initialSeconds?: number;
  onExpire?: () => void;
  className?: string;
}

export const Countdown: React.FC<CountdownProps> = ({
  venceEn,
  initialSeconds,
  onExpire,
  className,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (initialSeconds !== undefined) return initialSeconds;
    if (venceEn) {
      const diff = Math.floor((new Date(venceEn).getTime() - Date.now()) / 1000);
      return Math.max(0, diff);
    }
    return 900; // 15 mins default
  });

  useEffect(() => {
    if (!venceEn && initialSeconds === undefined) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [venceEn, initialSeconds, onExpire]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isUrgent = secondsLeft < 120; // Less than 2 mins: shown with an icon and a text, never only a color
  const isWarning = !isUrgent && secondsLeft < 360; // Less than 6 mins

  // Announce only at the 5-minute and 1-minute marks (never every second).
  const announcement = secondsLeft === 0 ? 'Tu reserva expiró.' : secondsLeft <= 60 ? 'Queda menos de 1 minuto para que expire tu reserva.' : secondsLeft <= 300 ? 'Quedan menos de 5 minutos para que expire tu reserva.' : '';

  return (
    <>
    <div
      className={clsx(
        'inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors select-none',
        isUrgent
          ? 'bg-danger-soft text-danger'
          : isWarning
          ? 'bg-warning-soft text-warning'
          : 'bg-gold-soft text-ink',
        className
      )}
      role="timer"
      aria-live="off"
      data-state={isUrgent ? 'urgent' : isWarning ? 'warning' : 'normal'}
    >
      {isUrgent ? <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> : <Clock className="w-3.5 h-3.5" aria-hidden="true" />}
      <span>Tu reserva expira en: <span className="num">{formattedTime}</span></span>
      {isUrgent && secondsLeft > 0 && <span>· Quedan menos de 2 minutos</span>}
    </div>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </>
  );
};

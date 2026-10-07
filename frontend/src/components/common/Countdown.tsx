import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
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

  const isUrgent = secondsLeft < 180; // Less than 3 mins
  const isWarning = secondsLeft < 360; // Less than 6 mins

  // Announce only at the 5-minute and 1-minute marks (never every second).
  const announcement = secondsLeft === 0 ? 'Tu reserva expiró.' : secondsLeft <= 60 ? 'Queda menos de 1 minuto para que expire tu reserva.' : secondsLeft <= 300 ? 'Quedan menos de 5 minutos para que expire tu reserva.' : '';

  return (
    <>
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors select-none',
        isUrgent
          ? 'bg-red-100 text-red-700'
          : isWarning
          ? 'bg-amber-100 text-amber-800'
          : 'bg-airline-blue-light text-airline-navy',
        className
      )}
      role="timer"
      aria-live="off"
    >
      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Tu reserva expira en: {formattedTime}</span>
    </div>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </>
  );
};

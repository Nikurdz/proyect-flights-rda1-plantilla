import React, { useEffect, useState } from 'react';
import { Plane } from 'lucide-react';
import { onServerWakeUpChange } from '../../api/client';

/** Shown when the first request takes long (the server may be starting). Sits below the header. */
export const WakeUpBanner: React.FC = () => {
  const [wakeState, setWakeState] = useState<{ isWakingUp: boolean; elapsedSeconds: number }>({
    isWakingUp: false,
    elapsedSeconds: 0,
  });

  useEffect(() => onServerWakeUpChange((status) => setWakeState(status)), []);

  if (!wakeState.isWakingUp) return null;

  const progressPercent = Math.min(95, Math.round((wakeState.elapsedSeconds / 50) * 100));

  return (
    <div className="border-b border-gold-text/30 bg-gold-soft px-4 py-2.5 text-ink" role="status" aria-live="polite">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-xs sm:flex-row sm:text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Plane className="h-4 w-4 text-gold-text" aria-hidden="true" />
          Estamos conectando con el servidor. La primera vez puede tardar un poco; no cierres la página.
        </span>
        {/* Decorative: the elapsed time is only an estimate, the text above carries the message. */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gold-text/20 sm:w-40" aria-hidden="true">
          <div className="h-full rounded-full bg-gold transition-all duration-1000 ease-linear" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    </div>
  );
};
